import * as core from '@actions/core';
import {
  downloadCommitSbomZip,
  getBranchName,
  getScanResult,
  isProperEvent,
  isRepoPublic,
  setInfo,
  uploadArtifacts,
} from './utils/DeepbitsGitHubAction';

export async function run(): Promise<void> {
  try {
    if (!(await isProperEvent())) {
      core.setFailed(
        'This action is available for branch push only at the moment.'
      );
      return;
    }

    const isPublic = await isRepoPublic();

    if (!isPublic) {
      core.setFailed('Private repositories are not supported.');
      return;
    }

    const branchName = getBranchName();

    if (!branchName) {
      core.setFailed('Branch name is not available.');
      return;
    }

    const scanResult = (await getScanResult(branchName))?.scanResult;

    let sbomZipFileLocation: string | undefined;

    if (scanResult?._id) {
      sbomZipFileLocation = await downloadCommitSbomZip(scanResult._id);
    }

    const {finalResult} = scanResult ?? {};

    await uploadArtifacts(
      [{name: 'scanSummary', jsonContent: finalResult || {}}],
      sbomZipFileLocation ? [sbomZipFileLocation] : undefined
    );

    await setInfo(branchName);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
