import {
  ContainerStaticResult,
  ContainerSummaryInfo,
  SBOMInfo,
} from './deepbitsScanResult';

export interface GitHubCommitItem {
  oid: string;
  message: string;
  commitUrl: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  repo: string;
}

export type GitHubCommitDef = GitHubCommitItem & {
  _id: string;
  createdAt: string;
  updatedAt: string;
  scanStartAt?: string;
  scanResult: string[];
  bucketName?: string;
  blobName?: string;
  sha: string;
};

export type ScanResult = {
  _id: string;
  createdAt: string;
  updatedAt: string;
  scanEndAt?: string;
  staticResult?: ContainerStaticResult[];
  finalResult?: ContainerSummaryInfo;
  sbomResult?: SBOMInfo[];
};

export type GitHubCommitDefWithPopulatedScanResult = Omit<
  GitHubCommitDef,
  'scanResult'
> & {
  scanResult?: ScanResult[];
};
