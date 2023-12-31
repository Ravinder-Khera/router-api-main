/**
 * ts-node --project=tsconfig.cdk.json scripts/get_quote.ts
 */
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
(async function () {
    const quotePost = {
        tokenInAddress: 'MKR',
        tokenInChainId: 1,
        tokenOutAddress: 'GRT',
        tokenOutChainId: 1,
        amount: '50',
        type: 'exactIn',
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm: 'alpha',
    };
    const response = await axios.post(process.env.UNISWAP_ROUTING_API + 'quote', quotePost);
    console.log({ response });
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0X3F1b3RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc2NyaXB0cy9nZXRfcXVvdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0dBRUc7QUFDSCxPQUFPLEtBQXdCLE1BQU0sT0FBTyxDQUFBO0FBQzVDLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQTtBQUczQixNQUFNLENBQUMsTUFBTSxFQUFFLENBQ2Q7QUFBQSxDQUFDLEtBQUs7SUFDTCxNQUFNLFNBQVMsR0FBcUI7UUFDbEMsY0FBYyxFQUFFLEtBQUs7UUFDckIsY0FBYyxFQUFFLENBQUM7UUFDakIsZUFBZSxFQUFFLEtBQUs7UUFDdEIsZUFBZSxFQUFFLENBQUM7UUFDbEIsTUFBTSxFQUFFLElBQUk7UUFDWixJQUFJLEVBQUUsU0FBUztRQUNmLFNBQVMsRUFBRSw0Q0FBNEM7UUFDdkQsaUJBQWlCLEVBQUUsR0FBRztRQUN0QixRQUFRLEVBQUUsS0FBSztRQUNmLFNBQVMsRUFBRSxPQUFPO0tBQ25CLENBQUE7SUFFRCxNQUFNLFFBQVEsR0FBaUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUM3RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFvQixHQUFHLE9BQU8sRUFDMUMsU0FBUyxDQUNWLENBQUE7SUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQTtBQUMzQixDQUFDLENBQUMsRUFBRSxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiB0cy1ub2RlIC0tcHJvamVjdD10c2NvbmZpZy5jZGsuanNvbiBzY3JpcHRzL2dldF9xdW90ZS50c1xuICovXG5pbXBvcnQgYXhpb3MsIHsgQXhpb3NSZXNwb25zZSB9IGZyb20gJ2F4aW9zJ1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnXG5pbXBvcnQgeyBRdW90ZVF1ZXJ5UGFyYW1zIH0gZnJvbSAnLi4vbGliL2hhbmRsZXJzL3F1b3RlL3NjaGVtYS9xdW90ZS1zY2hlbWEnXG5pbXBvcnQgeyBRdW90ZVJlc3BvbnNlIH0gZnJvbSAnLi4vbGliL2hhbmRsZXJzL3NjaGVtYSdcbmRvdGVudi5jb25maWcoKVxuOyhhc3luYyBmdW5jdGlvbiAoKSB7XG4gIGNvbnN0IHF1b3RlUG9zdDogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICB0b2tlbkluQWRkcmVzczogJ01LUicsXG4gICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgdG9rZW5PdXRBZGRyZXNzOiAnR1JUJyxcbiAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgYW1vdW50OiAnNTAnLFxuICAgIHR5cGU6ICdleGFjdEluJyxcbiAgICByZWNpcGllbnQ6ICcweEFiNTgwMWE3RDM5ODM1MWI4YkUxMUM0MzllMDVDNUIzMjU5YWVDOUInLFxuICAgIHNsaXBwYWdlVG9sZXJhbmNlOiAnNScsXG4gICAgZGVhZGxpbmU6ICczNjAnLFxuICAgIGFsZ29yaXRobTogJ2FscGhhJyxcbiAgfVxuXG4gIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MucG9zdDxRdW90ZVJlc3BvbnNlPihcbiAgICBwcm9jZXNzLmVudi5VTklTV0FQX1JPVVRJTkdfQVBJISArICdxdW90ZScsXG4gICAgcXVvdGVQb3N0XG4gIClcblxuICBjb25zb2xlLmxvZyh7IHJlc3BvbnNlIH0pXG59KSgpXG4iXX0=