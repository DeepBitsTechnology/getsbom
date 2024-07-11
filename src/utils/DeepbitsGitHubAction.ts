import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {
  BASE_URL,
  TOOLS_URL,
  getCommitResultUntilScanEnds,
  uploadAsset,
  addToProject,
  watchAsset,
  getFileScanResult,
} from './api';

const ROOT_DIRECTORY_NAME = 'DEEPBITS_SCAN_RESULTS';

export const isProperEvent = async (): Promise<boolean> => {
  const eventName = github.context.eventName;
  core.info(`Current event: ${eventName}`);
  return (
    eventName === 'push' ||
    eventName === 'pull_request' ||
    eventName === 'release'
  );
};

export const isRepoPublic = async (): Promise<boolean> => {
  const token = core.getInput('token');
  const context = github.context;

  const {owner, repo} = context.repo;

  const octokit = github.getOctokit(token);

  const {data} = await octokit.rest.repos.get({owner, repo});

  return !data.private;
};

export const getBranchName = () => {
  const context = github.context;

  const {ref} = context;
  const prHeadRef = process.env.GITHUB_HEAD_REF;

  return github.context.eventName === 'pull_request'
    ? prHeadRef
    : ref.replace('refs/heads/', '');
};

export const getSHA = () => {
  const context = github.context;

  const {sha} = context;

  return github.context.eventName === 'pull_request'
    ? github.context.payload.pull_request?.head.sha
    : sha;
};

export const getScanResult = async (branchName: string) => {
  const context = github.context;
  const {owner, repo} = context.repo;

  const sha = getSHA();

  const result = await getCommitResultUntilScanEnds({
    owner,
    repo,
    branchName,
    sha,
  });

  return result;
};

export const setInfo = async (branchName: string) => {
  const context = github.context;

  const {owner, repo} = context.repo;

  const infoList = [
    {
      name: 'DEEPSCA_REPO',
      value: `${TOOLS_URL}/${owner}/${repo}`,
    },
    {
      name: 'DEEPSCA_BRANCH',
      value: `${TOOLS_URL}/${owner}/${repo}/${branchName}`,
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
): Promise<string | undefined> => {
  if (!existsSync(ROOT_DIRECTORY_NAME)) {
    mkdirSync(ROOT_DIRECTORY_NAME);
  }

  const context = github.context;
  const {owner, repo} = context.repo;

  const sha = getSHA();

  const url = `${BASE_URL}/gh/${owner}/${repo}/${sha}/sbom/${sbomId}`;

  try {
    const fileResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'x-public-tool': 'true',
      },
    });

    const fileBuffer = Buffer.from(fileResponse.data);
    const fileName = fileResponse.headers['content-disposition']
      .match(/filename=([^;]+)/)[1]
      .replace(/"/g, '')
      .trim();
    const fileLocation = `${ROOT_DIRECTORY_NAME}/${fileName}`;

    writeFileSync(fileLocation, fileBuffer);

    return fileLocation;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      core.info('No SBOM found');
      return undefined;
    } else {
      core.setFailed('Failed to download SBOM');
      throw error;
    }
  }
};

export const uploadDockerImage = async (
  filePath: string,
  projectId: string
) => {
  const sbomBuilderId = await uploadAsset(filePath);
  if (!sbomBuilderId) {
    core.error('Failed to upload asset.');
    return undefined;
  }
  const assetId = await addToProject(projectId, sbomBuilderId);
  if (!assetId) {
    core.error('Failed to add asset to project');
    return undefined;
  }
  const streamId = await watchAsset(projectId, assetId, sbomBuilderId);
  if (!streamId) {
    core.error('Failed to watch asset');
    return undefined;
  }
  const startTime = Date.now();
  const timeOut = 3 * 60 * 60 * 1000;
  while (Date.now() - startTime < timeOut) {
    try {
      const scanResult = await getFileScanResult(projectId, assetId, streamId);
      const bom = scanResult?.scanResult?.finalResult?.bom;
      if (bom !== undefined) {
        return {bom, assetId, streamId};
      } else {
        core.info('Scan in progress');
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        continue;
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        core.debug('Repo/commit not added yet');
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        continue;
      } else {
        throw error;
      }
    }
  }
  core.error('Scan timeout');
  return undefined;
};
