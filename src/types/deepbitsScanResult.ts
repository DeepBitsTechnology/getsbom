export interface ContainerStaticResult {
  filePath: string;
  details: SBOMInfo[];
  langType: string;
  cve?: ([string, number, string] | undefined)[];
}

export interface ContainerSummaryInfo {
  bom?: string;
  vulnerabilities: {
    path: string;
    tag: string;
    cves: {
      name: string;
      score: number;
      description: string;
    }[];
  }[];
  malware: {
    path: string;
    family: string;
    score?: number;
    isCalculate: boolean;
  }[];
  saasbom?: SaaSBOMResponse | null;
}

export interface SBOMInfo {
  distribution: string;
  package: string;
  version: string;
  architecture: string;
  components: SBOMComponentInfo[];
  cve?: [string, number, string][];
  bom?: string;
  language?: string;
  malware?: {family?: string};
  isSystemPackage?: boolean;
  saasbom?: SaaSBOMResponse | null;
}

export interface SBOMComponentInfo {
  type: string;
  name: string;
  version: string;
  cve?: [string, number, string][];
  license: string[];
  dynamic?: boolean;
}

export interface SaaSBOMProvider {
  name: string;
  url: string[];
}

export interface SaaSBOM {
  provider: SaaSBOMProvider;
  name: string;
  description: string;
  endpoints: string[];
}

export interface SaaSBOMResponse {
  services?: SaaSBOM[];
}
