import * as core from '@actions/core';
import axios, {AxiosInstance} from 'axios';
import {ScanResultResponse} from '../types/deepbitsApi';

export const BASE_URL = 'https://api.deepbits.com';
export const TOOLS_URL = 'https://tools.deepbits.com/github';

const RETRY_DELAY = 60 * 1000; // in milliseconds (1 minute)
const TIMEOUT = 3 * 60 * 60 * 1000; // in milliseconds (3 hours)

export const getRetryDelay = (): number => RETRY_DELAY;
export const getTimeout = (): number => TIMEOUT;

const onError = (error: Error): unknown => {
  return Promise.reject(error);
};

const createInstance = (baseUrl: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: baseUrl,
  });

  instance.interceptors.request.use(async config => {
    config.headers.set('Content-Type', 'application/json');
    config.headers.set('x-public-tool', true);
    return config;
  }, onError);

  instance.interceptors.response.use(response => response.data, onError);

  return instance;
};

export const callDeepbitsApi = createInstance(BASE_URL);

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
