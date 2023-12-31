import hre from 'hardhat';
import { Erc20__factory } from '../../lib/types/ext';
const WHALES = [
    '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
    '0x6555e1cc97d3cba6eaddebbcd7ca51d75771e0b8',
    '0x08638ef1a205be6762a8b935f5da9b700cf7322c',
    '0xe8e8f41ed29e46f34e206d7d2a7d6f735a3ff2cb',
    '0x72a53cdbbcc1b9efa39c834a540550e23463aacb',
    '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
    '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf',
    '0x8eb8a3b98659cce290402893d0123abb75e3ab28',
    '0x1e3d6eab4bcf24bcd04721caa11c478a2e59852d',
    '0x28C6c06298d514Db089934071355E5743bf21d60',
    '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
    '0x2775b1c75658be0f640272ccb8c72ac986009e38',
    '0x28c6c06298d514db089934071355e5743bf21d60',
    '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
    '0x06601571aa9d3e8f5f7cdd5b993192618964bab5',
];
const { ethers } = hre;
export const resetAndFundAtBlock = async (alice, blockNumber, currencyAmounts) => {
    await hre.network.provider.request({
        method: 'hardhat_reset',
        params: [
            {
                forking: {
                    jsonRpcUrl: process.env.ARCHIVE_NODE_RPC,
                    blockNumber,
                },
            },
        ],
    });
    for (const whale of WHALES) {
        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whale],
        });
    }
    for (const currencyAmount of currencyAmounts) {
        const currency = currencyAmount.currency;
        const amount = currencyAmount.toExact();
        if (currency.isNative) {
            // Requested funding was for ETH. Hardhat prefunds Alice with 1000 Eth.
            return alice;
        }
        for (let i = 0; i < WHALES.length; i++) {
            const whale = WHALES[i];
            const whaleAccount = ethers.provider.getSigner(whale);
            try {
                const whaleToken = Erc20__factory.connect(currency.wrapped.address, whaleAccount);
                await whaleToken.transfer(alice.address, ethers.utils.parseUnits(amount, currency.decimals));
                break;
            }
            catch (err) {
                if (i == WHALES.length - 1) {
                    throw new Error(`Could not fund ${amount} ${currency.symbol} from any whales.`);
                }
            }
        }
    }
    return alice;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ya0FuZEZ1bmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi90ZXN0L3V0aWxzL2ZvcmtBbmRGdW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sR0FBRyxNQUFNLFNBQVMsQ0FBQTtBQUN6QixPQUFPLEVBQVMsY0FBYyxFQUFFLE1BQU0scUJBQXFCLENBQUE7QUFFM0QsTUFBTSxNQUFNLEdBQUc7SUFDYiw0Q0FBNEM7SUFDNUMsNENBQTRDO0lBQzVDLDRDQUE0QztJQUM1Qyw0Q0FBNEM7SUFDNUMsNENBQTRDO0lBQzVDLDRDQUE0QztJQUM1Qyw0Q0FBNEM7SUFDNUMsNENBQTRDO0lBQzVDLDRDQUE0QztJQUM1Qyw0Q0FBNEM7SUFDNUMsNENBQTRDO0lBQzVDLDRDQUE0QztJQUM1Qyw0Q0FBNEM7SUFDNUMsNENBQTRDO0lBQzVDLDRDQUE0QztJQUM1Qyw0Q0FBNEM7Q0FDN0MsQ0FBQTtBQUVELE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUE7QUFFdEIsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsS0FBSyxFQUN0QyxLQUF3QixFQUN4QixXQUFtQixFQUNuQixlQUEyQyxFQUNmLEVBQUU7SUFDOUIsTUFBTSxHQUFHLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDakMsTUFBTSxFQUFFLGVBQWU7UUFDdkIsTUFBTSxFQUFFO1lBQ047Z0JBQ0UsT0FBTyxFQUFFO29CQUNQLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQjtvQkFDeEMsV0FBVztpQkFDWjthQUNGO1NBQ0Y7S0FDRixDQUFDLENBQUE7SUFFRixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtRQUMxQixNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUNqQyxNQUFNLEVBQUUsNEJBQTRCO1lBQ3BDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQztTQUNoQixDQUFDLENBQUE7S0FDSDtJQUVELEtBQUssTUFBTSxjQUFjLElBQUksZUFBZSxFQUFFO1FBQzVDLE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUE7UUFDeEMsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBRXZDLElBQUksUUFBUSxDQUFDLFFBQVEsRUFBRTtZQUNyQix1RUFBdUU7WUFDdkUsT0FBTyxLQUFLLENBQUE7U0FDYjtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3RDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUN2QixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUNyRCxJQUFJO2dCQUNGLE1BQU0sVUFBVSxHQUFVLGNBQWMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUE7Z0JBRXhGLE1BQU0sVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtnQkFFNUYsTUFBSzthQUNOO1lBQUMsT0FBTyxHQUFHLEVBQUU7Z0JBQ1osSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxtQkFBbUIsQ0FBQyxDQUFBO2lCQUNoRjthQUNGO1NBQ0Y7S0FDRjtJQUVELE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU2lnbmVyV2l0aEFkZHJlc3MgfSBmcm9tICdAbm9taWNsYWJzL2hhcmRoYXQtZXRoZXJzL3NpZ25lcnMnXG5pbXBvcnQgeyBDdXJyZW5jeSwgQ3VycmVuY3lBbW91bnQgfSBmcm9tICdAdW5pc3dhcC9zZGstY29yZSdcbmltcG9ydCBocmUgZnJvbSAnaGFyZGhhdCdcbmltcG9ydCB7IEVyYzIwLCBFcmMyMF9fZmFjdG9yeSB9IGZyb20gJy4uLy4uL2xpYi90eXBlcy9leHQnXG5cbmNvbnN0IFdIQUxFUyA9IFtcbiAgJzB4QkUwZUI1M0Y0NmNkNzkwQ2QxMzg1MWQ1RUZmNDNEMTI0MDRkMzNFOCcsXG4gICcweDY1NTVlMWNjOTdkM2NiYTZlYWRkZWJiY2Q3Y2E1MWQ3NTc3MWUwYjgnLFxuICAnMHgwODYzOGVmMWEyMDViZTY3NjJhOGI5MzVmNWRhOWI3MDBjZjczMjJjJyxcbiAgJzB4ZThlOGY0MWVkMjllNDZmMzRlMjA2ZDdkMmE3ZDZmNzM1YTNmZjJjYicsXG4gICcweDcyYTUzY2RiYmNjMWI5ZWZhMzljODM0YTU0MDU1MGUyMzQ2M2FhY2InLFxuICAnMHhiZWJjNDQ3ODJjN2RiMGExYTYwY2I2ZmU5N2QwYjQ4MzAzMmZmMWM3JyxcbiAgJzB4NDBlYzViMzNmNTRlMGU4YTMzYTk3NTkwOGM1YmExYzE0ZTViYmJkZicsXG4gICcweDhlYjhhM2I5ODY1OWNjZTI5MDQwMjg5M2QwMTIzYWJiNzVlM2FiMjgnLFxuICAnMHgxZTNkNmVhYjRiY2YyNGJjZDA0NzIxY2FhMTFjNDc4YTJlNTk4NTJkJyxcbiAgJzB4MjhDNmMwNjI5OGQ1MTREYjA4OTkzNDA3MTM1NUU1NzQzYmYyMWQ2MCcsXG4gICcweEY5Nzc4MTRlOTBkQTQ0YkZBMDNiNjI5NUEwNjE2YTg5NzQ0MWFjZUMnLFxuICAnMHg1ZDNhNTM2ZTRkNmRiZDYxMTRjYzFlYWQzNTc3N2JhYjk0OGUzNjQzJyxcbiAgJzB4Mjc3NWIxYzc1NjU4YmUwZjY0MDI3MmNjYjhjNzJhYzk4NjAwOWUzOCcsXG4gICcweDI4YzZjMDYyOThkNTE0ZGIwODk5MzQwNzEzNTVlNTc0M2JmMjFkNjAnLFxuICAnMHg0N2FjMGZiNGYyZDg0ODk4ZTRkOWU3YjRkYWIzYzI0NTA3YTZkNTAzJyxcbiAgJzB4MDY2MDE1NzFhYTlkM2U4ZjVmN2NkZDViOTkzMTkyNjE4OTY0YmFiNScsXG5dXG5cbmNvbnN0IHsgZXRoZXJzIH0gPSBocmVcblxuZXhwb3J0IGNvbnN0IHJlc2V0QW5kRnVuZEF0QmxvY2sgPSBhc3luYyAoXG4gIGFsaWNlOiBTaWduZXJXaXRoQWRkcmVzcyxcbiAgYmxvY2tOdW1iZXI6IG51bWJlcixcbiAgY3VycmVuY3lBbW91bnRzOiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT5bXVxuKTogUHJvbWlzZTxTaWduZXJXaXRoQWRkcmVzcz4gPT4ge1xuICBhd2FpdCBocmUubmV0d29yay5wcm92aWRlci5yZXF1ZXN0KHtcbiAgICBtZXRob2Q6ICdoYXJkaGF0X3Jlc2V0JyxcbiAgICBwYXJhbXM6IFtcbiAgICAgIHtcbiAgICAgICAgZm9ya2luZzoge1xuICAgICAgICAgIGpzb25ScGNVcmw6IHByb2Nlc3MuZW52LkFSQ0hJVkVfTk9ERV9SUEMsXG4gICAgICAgICAgYmxvY2tOdW1iZXIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pXG5cbiAgZm9yIChjb25zdCB3aGFsZSBvZiBXSEFMRVMpIHtcbiAgICBhd2FpdCBocmUubmV0d29yay5wcm92aWRlci5yZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ2hhcmRoYXRfaW1wZXJzb25hdGVBY2NvdW50JyxcbiAgICAgIHBhcmFtczogW3doYWxlXSxcbiAgICB9KVxuICB9XG5cbiAgZm9yIChjb25zdCBjdXJyZW5jeUFtb3VudCBvZiBjdXJyZW5jeUFtb3VudHMpIHtcbiAgICBjb25zdCBjdXJyZW5jeSA9IGN1cnJlbmN5QW1vdW50LmN1cnJlbmN5XG4gICAgY29uc3QgYW1vdW50ID0gY3VycmVuY3lBbW91bnQudG9FeGFjdCgpXG5cbiAgICBpZiAoY3VycmVuY3kuaXNOYXRpdmUpIHtcbiAgICAgIC8vIFJlcXVlc3RlZCBmdW5kaW5nIHdhcyBmb3IgRVRILiBIYXJkaGF0IHByZWZ1bmRzIEFsaWNlIHdpdGggMTAwMCBFdGguXG4gICAgICByZXR1cm4gYWxpY2VcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IFdIQUxFUy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgd2hhbGUgPSBXSEFMRVNbaV1cbiAgICAgIGNvbnN0IHdoYWxlQWNjb3VudCA9IGV0aGVycy5wcm92aWRlci5nZXRTaWduZXIod2hhbGUpXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB3aGFsZVRva2VuOiBFcmMyMCA9IEVyYzIwX19mYWN0b3J5LmNvbm5lY3QoY3VycmVuY3kud3JhcHBlZC5hZGRyZXNzLCB3aGFsZUFjY291bnQpXG5cbiAgICAgICAgYXdhaXQgd2hhbGVUb2tlbi50cmFuc2ZlcihhbGljZS5hZGRyZXNzLCBldGhlcnMudXRpbHMucGFyc2VVbml0cyhhbW91bnQsIGN1cnJlbmN5LmRlY2ltYWxzKSlcblxuICAgICAgICBicmVha1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChpID09IFdIQUxFUy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZnVuZCAke2Ftb3VudH0gJHtjdXJyZW5jeS5zeW1ib2x9IGZyb20gYW55IHdoYWxlcy5gKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFsaWNlXG59XG4iXX0=