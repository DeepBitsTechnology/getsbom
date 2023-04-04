import * as core from '@actions/core';
import {
  downloadCommitSbomZip,
  getScanResult,
  isRepoPublic,
  setInfo,
  uploadArtifacts,
} from './utils/DeepbitsGitHubAction';

export async function run(): Promise<void> {
  try {
    const isPublic = await isRepoPublic();

    if (!isPublic) {
      core.setFailed('Private repositories are not supported');
      return;
    }

    const scanResult = (await getScanResult())?.scanResult?.[0];

    let sbomZipFileLocation: string | undefined;

    if (scanResult?._id) {
      sbomZipFileLocation = await downloadCommitSbomZip(scanResult._id);
    }

    const {finalResult} = scanResult ?? {};

    await uploadArtifacts(
      [{name: 'scanSummary', jsonContent: finalResult || {}}],
      sbomZipFileLocation ? [sbomZipFileLocation] : undefined
    );

    await setInfo();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
