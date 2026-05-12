import { SlideContainer } from '../components/layout/SlideContainer';
import { BreathingCard } from '../components/common/BreathingCard';
import { AmountDisplay } from '../components/common/AmountDisplay';

export function NetWorthSlide() {
  return (
    <SlideContainer title="家庭净值总览" subtitle="实时资产与负债净值计算">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-2">总资产</h3>
          <div className="text-2xl font-bold text-ledger-success">
            <AmountDisplay amount={2500000} />
          </div>
        </BreathingCard>
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-2">总负债</h3>
          <div className="text-2xl font-bold text-ledger-danger">
            <AmountDisplay amount={800000} />
          </div>
        </BreathingCard>
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-2">净资产</h3>
          <div className="text-3xl font-bold text-ledger-primary">
            <AmountDisplay amount={1700000} />
          </div>
        </BreathingCard>
      </div>
      <div className="mt-8">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">净值趋势</h3>
          <div className="h-64 flex items-center justify-center text-ledger-muted">
            [净值趋势图表占位]
          </div>
        </BreathingCard>
      </div>
    </SlideContainer>
  );
}
