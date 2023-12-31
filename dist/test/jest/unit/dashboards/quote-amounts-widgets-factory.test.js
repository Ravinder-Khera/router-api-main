import { QuoteAmountsWidgetsFactory } from '../../../../lib/dashboards/quote-amounts-widgets-factory';
import { describe, it, expect } from '@jest/globals';
const quoteAmountsWidgets = new QuoteAmountsWidgetsFactory('Uniswap', 'us-west-1');
describe('Test widgets', () => {
    it('works', () => {
        const widgets = quoteAmountsWidgets.generateWidgets();
        // It's hard to write a meaningful test here.
        expect(widgets.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtYW1vdW50cy13aWRnZXRzLWZhY3RvcnkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Rlc3QvamVzdC91bml0L2Rhc2hib2FyZHMvcXVvdGUtYW1vdW50cy13aWRnZXRzLWZhY3RvcnkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQTtBQUNyRyxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUE7QUFFcEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLDBCQUEwQixDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQTtBQUVsRixRQUFRLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRTtJQUM1QixFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtRQUNmLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixDQUFDLGVBQWUsRUFBRSxDQUFBO1FBQ3JELDZDQUE2QztRQUM3QyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUMzQyxDQUFDLENBQUMsQ0FBQTtBQUNKLENBQUMsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUXVvdGVBbW91bnRzV2lkZ2V0c0ZhY3RvcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9saWIvZGFzaGJvYXJkcy9xdW90ZS1hbW91bnRzLXdpZGdldHMtZmFjdG9yeSdcbmltcG9ydCB7IGRlc2NyaWJlLCBpdCwgZXhwZWN0IH0gZnJvbSAnQGplc3QvZ2xvYmFscydcblxuY29uc3QgcXVvdGVBbW91bnRzV2lkZ2V0cyA9IG5ldyBRdW90ZUFtb3VudHNXaWRnZXRzRmFjdG9yeSgnVW5pc3dhcCcsICd1cy13ZXN0LTEnKVxuXG5kZXNjcmliZSgnVGVzdCB3aWRnZXRzJywgKCkgPT4ge1xuICBpdCgnd29ya3MnLCAoKSA9PiB7XG4gICAgY29uc3Qgd2lkZ2V0cyA9IHF1b3RlQW1vdW50c1dpZGdldHMuZ2VuZXJhdGVXaWRnZXRzKClcbiAgICAvLyBJdCdzIGhhcmQgdG8gd3JpdGUgYSBtZWFuaW5nZnVsIHRlc3QgaGVyZS5cbiAgICBleHBlY3Qod2lkZ2V0cy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKVxuICB9KVxufSlcbiJdfQ==