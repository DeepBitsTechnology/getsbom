import * as core from '@actions/core';
import {getInput} from '@actions/core';
import axios, {AxiosInstance} from 'axios';
import {ScanResultResponse} from '../types/deepbitsApi';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import stream from 'node:stream/promises';

export const BASE_URL = 'https://api.deepbits.com';
export const TOOLS_URL = 'https://tools.deepbits.com/github';

const RETRY_DELAY = 60 * 1000; // in milliseconds (1 minute)
const TIMEOUT = 3 * 60 * 60 * 1000; // in milliseconds (3 hours)

export const getRetryDelay = (): number => RETRY_DELAY;
export const getTimeout = (): number => TIMEOUT;

const onError = (error: Error): unknown => {
  return Promise.reject(error);
};

const computeHash = async (filePath: string): Promise<string> => {
  const input = fs.createReadStream(filePath);
  const hash = crypto.createHash('sha256');

  // Connect the output of the `input` stream to the input of `hash`
  // and let Node.js do the streaming
  await stream.pipeline(input, hash);

  return hash.digest('hex');
};

const createInstance = (baseUrl: string, apiKey: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: baseUrl,
  });

  instance.interceptors.request.use(async config => {
    config.headers.set('Content-Type', 'application/json');
    if (apiKey) {
      config.headers.set('x-api-key', apiKey);
    } else {
      config.headers.set('x-public-tool', true);
    }
    return config;
  }, onError);

  instance.interceptors.response.use(response => response.data, onError);

  return instance;
};

export const callDeepbitsApi = createInstance(BASE_URL, '');
export const callPrivateApi = createInstance(
  BASE_URL,
  getInput('apiKey', {required: false, trimWhitespace: true})
);

export const getCommitResult = async ({
  owner,
  repo,
  branchName,
  sha,
}: {
  owner: string;
  repo: string;
  branchName: string;
  sha: string;
}): Promise<ScanResultResponse> => {
  const url = `/gha/${owner}/${repo}/${encodeURIComponent(branchName)}/${sha}`;

  const result = await callDeepbitsApi.get(url);

  return result.data;
};

export const getCommitResultUntilScanEnds = async ({
  owner,
  repo,
  branchName,
  sha,
}: {
  owner: string;
  repo: string;
  branchName: string;
  sha: string;
}): Promise<ScanResultResponse | undefined> => {
  const retryDelay = getRetryDelay();
  const timeOut = getTimeout();
  const startTime = Date.now();

  let scanResult;

  while (Date.now() - startTime < timeOut) {
    try {
      scanResult = await getCommitResult({owner, repo, branchName, sha});

      if (scanResult?.scanResult?.scanEndAt) {
        core.info('Scan finished');
        return scanResult;
      } else {
        core.info('Scan in progress');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        core.debug('Repo/commit not added yet');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      } else {
        throw error;
      }
    }
  }

  core.setFailed('Scan timed out');
  return scanResult;
};

export const uploadAsset = async (filePath: string): Promise<string> => {
  core.info(`Upload Asset, path = ${filePath}`);
  const result = await callPrivateApi.post('/api/v1/sbom_builder/upload_url', {
    fileName: path.basename(filePath),
  });
  const presignedURL = result.data;
  core.info(`presignedURL = ${presignedURL.uploadUrl}`);
  const {size} = fs.statSync(filePath);
  await axios.put(presignedURL.uploadUrl, fs.createReadStream(filePath), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size,
    },
  });
  const resp = await callPrivateApi.put('/api/v1/sbom_builder/upload_success', {
    path: presignedURL.path,
    sha256: await computeHash(filePath),
    fileName: path.basename(filePath),
  });
  const assetId = resp.data['_id'];
  core.info(`asset id = ${assetId}`);
  return assetId;
};

export const addToProject = async (
  projectId: string,
  sbomBuilderId: string
): Promise<any> => {
  core.info(`Adding to project ${projectId} with ${sbomBuilderId}`);
  const resp = await callPrivateApi.get(`/api/v1/project/${projectId}`);
  const selected = resp.data;
  let assets = selected.assets;
  for (const asset of assets) {
    delete asset.assetIdsWithDetails;
    if (asset.assetType === 'SBOMBuilder') {
      asset.assetIds.push(sbomBuilderId);
    }
  }
  if (assets.length === 0) {
    assets = [
      {
        assetType: 'SBOMBuilder',
        assetIds: [sbomBuilderId],
      },
    ];
  }
  const updateResp = await callPrivateApi.put(`/api/v1/project/${projectId}`, {
    name: selected.name,
    assets,
  });
  for (const asset of updateResp.data.createdAssets) {
    if (asset.sbomBuilderId === sbomBuilderId) {
      return asset['_id'];
    }
  }
};

export const watchAsset = async (
  projectId: string,
  assetId: string,
  sbomBuilderId: string
): Promise<string> => {
  core.info(`Watching assets ${projectId}, ${assetId}`);
  const resp = await callPrivateApi.put(
    `/api/v1/project/${projectId}/${assetId}/stream_watch`,
    {
      action: 'watch',
      identifier: sbomBuilderId,
    }
  );
  return resp.data['_id'];
};

export const getFileScanResult = async (
  projectId: string,
  assetId: string,
  streamId: string
): Promise<any> => {
  core.info('Getting scan result');
  const resp = await callPrivateApi.get(
    `/api/v1/project/${projectId}/${assetId}/${streamId}/scan_result`
  );
  return resp.data;
};
