import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {BASE_URL, TOOLS_URL, getCommitResultUntilScanEnds} from './api';

const ROOT_DIRECTORY_NAME = 'DEEPBITS_SCAN_RESULTS';

export const isRepoPublic = async (): Promise<boolean> => {
  const token = core.getInput('token');
  const context = github.context;

  const {owner, repo} = context.repo;

  const octokit = github.getOctokit(token);

  const {data} = await octokit.rest.repos.get({owner, repo});

  return !data.private;
};

export const getScanResult = async () => {
  const context = github.context;

  const {sha} = context;
  const {owner, repo} = context.repo;

  const result = await getCommitResultUntilScanEnds({owner, repo, sha});

  return result;
};

export const setInfo = async () => {
  const context = github.context;

  const {sha} = context;
  const {owner, repo} = context.repo;

  const infoList = [
    {
      name: 'DEEPBITS_REPO',
      value: `${TOOLS_URL}/${owner}/${repo}`,
    },
    {
      name: 'DEEPBITS_COMMIT',
      value: `${TOOLS_URL}/${owner}/${repo}/${sha}`,
    },
    {
      name: 'DEEPBITS_BADGE',
      value: `${BASE_URL}/gh/${owner}/${repo}/badge`,
    },
  ];

  for (const {name, value} of infoList) {
    core.setOutput(name, value);
    core.info(`${name}: ${value}`);
  }
};

export const uploadArtifacts = async (
  artifacts: {
    name: string;
    jsonContent: any;
  }[],
  fileLocations?: string[]
) => {
  if (!existsSync(ROOT_DIRECTORY_NAME)) {
    mkdirSync(ROOT_DIRECTORY_NAME);
  }

  const files = await Promise.all(
    artifacts.map(async ({name, jsonContent}) => {
      const fileName = `${ROOT_DIRECTORY_NAME}/${name}.json`;

      writeFileSync(fileName, JSON.stringify(jsonContent));

      return fileName;
    })
  );

  const artifactClient = artifact.create();
  const uploadResponse = await artifactClient.uploadArtifact(
    ROOT_DIRECTORY_NAME,
    [...files, ...(fileLocations || [])],
    '.',
    {
      continueOnError: true,
    }
  );

  return {
    success: uploadResponse.failedItems.length === 0,
  };
};

export const downloadCommitSbomZip = async (
  sbomId: string
): Promise<string> => {
  if (!existsSync(ROOT_DIRECTORY_NAME)) {
    mkdirSync(ROOT_DIRECTORY_NAME);
  }

  const context = github.context;

  const {sha} = context;
  const {owner, repo} = context.repo;

  const url = `${BASE_URL}/gh/${owner}/${repo}/${sha}/sbom/${sbomId}`;

  const fileResponse = await axios.get(url, {responseType: 'arraybuffer'});

  const fileBuffer = Buffer.from(fileResponse.data);
  const fileName = fileResponse.headers['content-disposition']
    .match(/filename=([^;]+)/)[1]
    .replace(/"/g, '')
    .trim();
  const fileLocation = `${ROOT_DIRECTORY_NAME}/${fileName}`;

  writeFileSync(fileLocation, fileBuffer);

  return fileLocation;
};
