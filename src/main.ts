import * as core from '@actions/core';
import {
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

    const scanResult = await getScanResult();

    const {finalResult} = scanResult?.scanResult?.[0] ?? {};

    await uploadArtifacts([
      {name: 'sbom.CycloneDX', jsonContent: finalResult?.bom || {}},
      {name: 'scanSummary', jsonContent: finalResult || {}},
    ]);

    await setInfo();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
