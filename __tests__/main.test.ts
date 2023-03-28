import * as core from '@actions/core';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {run} from '../src/main';
import {GitHubCommitDefWithPopulatedScanResult} from '../src/types/deepbitsApi';
import * as deepbitsAction from '../src/utils/DeepbitsGitHubAction';

jest.mock('@actions/core');
jest.mock('../src/utils/DeepbitsGitHubAction');

describe('Main', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('run', () => {
    it('should set failed status if repository is private', async () => {
      jest.spyOn(deepbitsAction, 'isRepoPublic').mockResolvedValueOnce(false);

      await run();

      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setFailed).toHaveBeenCalledWith(
        'Private repositories are not supported'
      );
    });

    it('should call expected functions with correct parameters if repository is public and scan result exists', async () => {
      jest.spyOn(deepbitsAction, 'isRepoPublic').mockResolvedValueOnce(true);

      const mockScanResult = {
        scanResult: [
          {
            finalResult: {bom: 'bom'},
            staticResult: [{filePath: 'fp'}],
            scanEndAt: Date.now().toString(),
          },
        ],
      } as GitHubCommitDefWithPopulatedScanResult;
      jest
        .spyOn(deepbitsAction, 'getScanResult')
        .mockResolvedValueOnce(mockScanResult);

      // Set up the expected artifact upload parameters
      const expectedUploadParams = [
        {name: 'sbom.CycloneDX', jsonContent: 'bom'},
        {name: 'staticResult', jsonContent: [{filePath: 'fp'}]},
        {name: 'finalResult', jsonContent: {bom: 'bom'}},
      ];

      await run();

      expect(core.setFailed).not.toHaveBeenCalled();

      expect(deepbitsAction.uploadArtifacts).toHaveBeenCalledTimes(1);
      expect(deepbitsAction.uploadArtifacts).toHaveBeenCalledWith(
        expectedUploadParams
      );

      expect(deepbitsAction.setInfo).toHaveBeenCalledTimes(1);
    });

    it('should call expected functions with correct parameters if repository is public and scan result does not exist', async () => {
      jest.spyOn(deepbitsAction, 'isRepoPublic').mockResolvedValueOnce(true);

      jest
        .spyOn(deepbitsAction, 'getScanResult')
        .mockResolvedValueOnce(undefined);

      const expectedUploadParams = [
        {name: 'sbom.CycloneDX', jsonContent: {}},
        {name: 'staticResult', jsonContent: {}},
        {name: 'finalResult', jsonContent: {}},
      ];

      await run();

      expect(core.setFailed).not.toHaveBeenCalled();

      expect(deepbitsAction.uploadArtifacts).toHaveBeenCalledTimes(1);
      expect(deepbitsAction.uploadArtifacts).toHaveBeenCalledWith(
        expectedUploadParams
      );

      expect(deepbitsAction.setInfo).toHaveBeenCalledTimes(1);
    });
  });
});
