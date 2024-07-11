import * as core from '@actions/core';
import {
  downloadCommitSbomZip,
  getBranchName,
  getScanResult,
  isProperEvent,
  isRepoPublic,
  setInfo,
  uploadArtifacts,
  uploadDockerImage,
} from './utils/DeepbitsGitHubAction';
import {getInput} from '@actions/core';
import fs from 'node:fs/promises';
import * as artifact from '@actions/artifact';

export async function run(): Promise<void> {
  try {
    if (!(await isProperEvent())) {
      core.warning(
        'This action is available for branch push and release only at the moment.'
      );
      return;
    }

    const path = getInput('path', {required: false});
    const projectId = getInput('project', {required: false});
    core.info(`path = ${path} and project = ${projectId}`);

    if (path && projectId) {
      //
      const uploadResult = await uploadDockerImage(path, projectId);
      if (uploadResult === undefined) {
        core.setFailed('Upload docker image failed.');
        return;
      }
      const {bom, assetId, streamId} = uploadResult;
      core.setOutput('bom', bom);
      await fs.writeFile('/tmp/bom.json', bom);
      core.setOutput('bomPath', '/tmp/bom.json');
      const scanURL = `https://app.deepbits.com/project/${projectId}/${assetId}/${streamId}`;
      await core.summary
        .addHeading('Deepbits Scan Result', 3)
        .addLink(scanURL, scanURL)
        .write();
      await artifact
        .create()
        .uploadArtifact('sbom.json', ['/tmp/bom.json'], '/tmp', {
          continueOnError: true,
        });
    } else {
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
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
