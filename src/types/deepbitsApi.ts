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

export interface ScanResultResponse {
  scanResult?: ScanResult;
  resourceMetaData?: any; // TODO: Feature Roadmap
  sbomStream?: any; // TODO: Feature Roadmap
}
