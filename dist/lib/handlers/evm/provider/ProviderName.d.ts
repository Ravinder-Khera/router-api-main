export declare enum ProviderName {
    INFURA = "INFURA",
    QUICKNODE = "QUICKNODE",
    FORNO = "FORNO",
    UNKNOWN = "UNKNOWN"
}
export declare function deriveProviderName(url: string): ProviderName;
