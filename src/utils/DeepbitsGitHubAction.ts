import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {BASE_URL, getCommitResultUntilScanEnds, TOOLS_URL} from './api';

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
  }[]
) => {
  const rootDirectory = 'DEEPBITS_SCAN_RESULTS';

  if (!existsSync(rootDirectory)) {
    mkdirSync(rootDirectory);
  }

  const files = await Promise.all(
    artifacts.map(async ({name, jsonContent}) => {
      const fileName = `${rootDirectory}/${name}.json`;

      writeFileSync(fileName, JSON.stringify(jsonContent));

      return fileName;
    })
  );

  const artifactClient = artifact.create();
  const uploadResponse = await artifactClient.uploadArtifact(
    rootDirectory,
    files,
    '.',
    {
      continueOnError: true,
    }
  );

  return {
    success: uploadResponse.failedItems.length === 0,
  };
};
