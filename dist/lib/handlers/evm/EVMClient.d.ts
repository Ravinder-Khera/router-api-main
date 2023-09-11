import { ethers } from 'ethers';
export interface EVMClient {
    getProvider(): ethers.providers.JsonRpcProvider;
}
export declare type EVMClientProps = {
    allProviders: Array<ethers.providers.JsonRpcProvider>;
};
export declare class DefaultEVMClient implements EVMClient {
    private readonly allProviders;
    constructor({ allProviders }: EVMClientProps);
    getProvider(): ethers.providers.JsonRpcProvider;
}
