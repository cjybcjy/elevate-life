import { SlideContainer } from '../components/layout/SlideContainer';
import { BreathingCard } from '../components/common/BreathingCard';
import { AmountDisplay } from '../components/common/AmountDisplay';

export function DebtOverviewSlide() {
  return (
    <SlideContainer title="负债总览" subtitle="贷款明细与还款进度">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">贷款列表</h3>
          <div className="space-y-4">
            <div className="p-3 bg-ledger-bg rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-ledger-text">房贷</span>
                <AmountDisplay amount={600000} className="text-ledger-danger" />
              </div>
              <div className="mt-2 h-2 bg-ledger-bg rounded-full overflow-hidden">
                <div className="h-full bg-ledger-primary w-1/3 rounded-full" />
              </div>
              <p className="text-xs text-ledger-muted mt-1">已还 33%</p>
            </div>
            <div className="p-3 bg-ledger-bg rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-ledger-text">车贷</span>
                <AmountDisplay amount={200000} className="text-ledger-danger" />
              </div>
              <div className="mt-2 h-2 bg-ledger-bg rounded-full overflow-hidden">
                <div className="h-full bg-ledger-primary w-1/2 rounded-full" />
              </div>
              <p className="text-xs text-ledger-muted mt-1">已还 50%</p>
            </div>
          </div>
        </BreathingCard>
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">还款里程碑</h3>
          <div className="h-64 flex items-center justify-center text-ledger-muted">
            [里程碑时间线占位]
          </div>
        </BreathingCard>
      </div>
    </SlideContainer>
  );
}
