import * as core from '@actions/core';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {GitHubCommitDefWithPopulatedScanResult} from '../../src/types/deepbitsApi';
import * as deepbitsApi from '../../src/utils/api';

jest.mock('@actions/core');

describe('getCommitResultUntilScanEnds', () => {
  const owner = 'test-owner';
  const repo = 'test-repo';
  const sha = 'test-sha';

  const incompleteData = {} as GitHubCommitDefWithPopulatedScanResult;
  const incompleteDataPartialScanResult = {
    scanResult: [{}],
  } as GitHubCommitDefWithPopulatedScanResult;
  const completeData = {
    scanResult: [{scanEndAt: Date.now().toString()}],
  } as GitHubCommitDefWithPopulatedScanResult;

  beforeEach(() => {
    jest.spyOn(deepbitsApi, 'getRetryDelay').mockReturnValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should return scan result when scan is finished', async () => {
    jest.spyOn(deepbitsApi, 'getCommitResult').mockResolvedValue(completeData);

    const result = await deepbitsApi.getCommitResultUntilScanEnds({
      owner,
      repo,
      sha,
    });

    expect(result).toEqual(completeData);
  });

  it('should retry until scan is finished', async () => {
    jest
      .spyOn(deepbitsApi, 'getCommitResult')
      .mockResolvedValueOnce(incompleteData)
      .mockResolvedValueOnce(incompleteDataPartialScanResult)
      .mockResolvedValue(completeData);

    await deepbitsApi.getCommitResultUntilScanEnds({owner, repo, sha});

    expect(deepbitsApi.getCommitResult).toHaveBeenCalledTimes(3);
  });

  it('should return scan result & set action failed if scan times out', async () => {
    jest.spyOn(deepbitsApi, 'getTimeout').mockReturnValue(20);

    jest
      .spyOn(deepbitsApi, 'getCommitResult')
      .mockResolvedValue(incompleteData);

    await expect(
      deepbitsApi.getCommitResultUntilScanEnds({owner, repo, sha})
    ).resolves.toEqual(incompleteData);

    expect(core.setFailed).toHaveBeenCalledWith('Scan timed out');
  });

  it('should not throw error if repo/commit is not added yet', async () => {
    const notFoundError = {response: {status: 404}};

    jest
      .spyOn(deepbitsApi, 'getCommitResult')
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValue(completeData);

    await expect(
      deepbitsApi.getCommitResultUntilScanEnds({owner, repo, sha})
    ).resolves.toEqual(completeData);

    expect(deepbitsApi.getCommitResult).toHaveBeenCalledTimes(3);
  });

  it('should throw error for other errors', async () => {
    const otherError = new Error('Unexpected error');
    jest.spyOn(deepbitsApi, 'getCommitResult').mockRejectedValue(otherError);

    await expect(
      deepbitsApi.getCommitResultUntilScanEnds({owner, repo, sha})
    ).rejects.toThrow(otherError);
  });
});
