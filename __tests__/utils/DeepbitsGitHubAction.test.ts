import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import * as fs from 'fs';
import {GitHubCommitDefWithPopulatedScanResult} from '../../src/types/deepbitsApi';
import * as deepbitsApi from '../../src/utils/api';
import {
  getScanResult,
  isRepoPublic,
  setInfo,
  uploadArtifacts,
} from '../../src/utils/DeepbitsGitHubAction';

const testToken = 'test-token';

jest.mock('@actions/artifact');
jest.mock('@actions/core');
jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    sha: 'test-sha',
  },
  getOctokit: jest.fn(),
}));

jest.mock('fs', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('DeepbitsGitHubAction', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('isRepoPublic', () => {
    it('should return true when repo is public', async () => {
      const getInputMock = jest
        .spyOn(core, 'getInput')
        .mockReturnValueOnce(testToken);

      const getOctokitMock = jest
        .spyOn(github, 'getOctokit')
        .mockReturnValueOnce({
          rest: {
            repos: {
              get: jest
                .fn()
                .mockResolvedValueOnce({data: {private: false}} as never),
            },
          },
        } as any);

      const result = await isRepoPublic();

      expect(getInputMock).toHaveBeenCalled();
      expect(getOctokitMock).toHaveBeenCalledWith(testToken);
      expect(result).toBe(true);
    });
  });

  describe('getScanResult', () => {
    it('should return the commit scan result', async () => {
      const completeData = {
        scanResult: [{scanEndAt: Date.now().toString()}],
      } as GitHubCommitDefWithPopulatedScanResult;

      const getCommitResultUntilScanEndsMock = jest
        .spyOn(deepbitsApi, 'getCommitResultUntilScanEnds')
        .mockResolvedValueOnce(completeData);

      const result = await getScanResult();

      expect(getCommitResultUntilScanEndsMock).toHaveBeenCalled();
      expect(result).toEqual(completeData);
    });
  });

  describe('setInfo', () => {
    it('should set the output values and log them', async () => {
      const setOutputMock = jest.spyOn(core, 'setOutput');
      const infoMock = jest.spyOn(core, 'info');

      await setInfo();

      expect(setOutputMock).toHaveBeenCalledTimes(3);
      expect(infoMock).toHaveBeenCalledTimes(3);
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        `DEEPBITS_REPO: ${deepbitsApi.TOOLS_URL}/test-owner/test-repo`
      );
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        `DEEPBITS_COMMIT: ${deepbitsApi.TOOLS_URL}/test-owner/test-repo/test-sha`
      );
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        `DEEPBITS_BADGE: ${deepbitsApi.BASE_URL}/gh/test-owner/test-repo/badge`
      );
    });
  });

  describe('uploadArtifacts', () => {
    const rootDirectory = 'DEEPBITS_SCAN_RESULTS';

    const filesToUpload = [
      {name: 'staticResult', jsonContent: {}},
      {name: 'finalResult', jsonContent: {}},
    ];

    const mkdirSyncMock = jest.spyOn(fs, 'mkdirSync');
    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    it('should upload the artifacts and return success true', async () => {
      const existsSyncMock = jest
        .spyOn(fs, 'existsSync')
        .mockReturnValueOnce(false);

      const uploadArtifactMock = jest.fn().mockResolvedValueOnce({
        failedItems: [],
      } as never);
      jest.spyOn(artifact, 'create').mockReturnValueOnce({
        uploadArtifact: uploadArtifactMock,
      } as any);

      const result = await uploadArtifacts(filesToUpload);

      expect(existsSyncMock).toHaveBeenCalledWith(rootDirectory);
      expect(mkdirSyncMock).toHaveBeenCalledWith(rootDirectory);

      expect(writeFileSyncMock).toHaveBeenCalledTimes(2);
      expect(writeFileSyncMock).toHaveBeenNthCalledWith(
        1,
        `${rootDirectory}/staticResult.json`,
        '{}'
      );
      expect(writeFileSyncMock).toHaveBeenNthCalledWith(
        2,
        `${rootDirectory}/finalResult.json`,
        '{}'
      );

      expect(uploadArtifactMock).toHaveBeenCalledWith(
        rootDirectory,
        [
          `${rootDirectory}/staticResult.json`,
          `${rootDirectory}/finalResult.json`,
        ],
        '.',
        {continueOnError: true}
      );
      expect(result).toEqual({success: true});
    });

    it('should upload the artifacts and return success false', async () => {
      const existsSyncMock = jest
        .spyOn(fs, 'existsSync')
        .mockReturnValueOnce(true);

      const uploadArtifactMock = jest.fn().mockResolvedValueOnce({
        failedItems: ['DEEPBITS_SCAN_RESULTS/staticResult.json'],
      } as never);
      jest.spyOn(artifact, 'create').mockReturnValueOnce({
        uploadArtifact: uploadArtifactMock,
      } as any);

      const result = await uploadArtifacts(filesToUpload);

      expect(existsSyncMock).toHaveBeenCalledWith('DEEPBITS_SCAN_RESULTS');
      expect(mkdirSyncMock).not.toHaveBeenCalled();

      expect(writeFileSyncMock).toHaveBeenCalledTimes(2);
      expect(writeFileSyncMock).toHaveBeenNthCalledWith(
        1,
        `${rootDirectory}/staticResult.json`,
        '{}'
      );
      expect(writeFileSyncMock).toHaveBeenNthCalledWith(
        2,
        `${rootDirectory}/finalResult.json`,
        '{}'
      );

      expect(uploadArtifactMock).toHaveBeenCalledWith(
        rootDirectory,
        [
          `${rootDirectory}/staticResult.json`,
          `${rootDirectory}/finalResult.json`,
        ],
        '.',
        {continueOnError: true}
      );
      expect(result).toEqual({success: false});
    });
  });
});
