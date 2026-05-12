import { SlideContainer } from '../components/layout/SlideContainer';
import { BreathingCard } from '../components/common/BreathingCard';

export function ScissorChartSlide() {
  return (
    <SlideContainer title="收支剪刀图" subtitle="收入与支出对比分析">
      <div className="grid grid-cols-1 gap-6">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">月度收支对比</h3>
          <div className="h-80 flex items-center justify-center text-ledger-muted">
            [剪刀图占位 - 收入 vs 支出 双轴对比]
          </div>
        </BreathingCard>
        <div className="grid grid-cols-2 gap-6">
          <BreathingCard>
            <h3 className="text-ledger-muted text-sm mb-2">本月收入</h3>
            <p className="text-2xl font-bold text-ledger-success">¥ 45,000</p>
          </BreathingCard>
          <BreathingCard>
            <h3 className="text-ledger-muted text-sm mb-2">本月支出</h3>
            <p className="text-2xl font-bold text-ledger-danger">¥ 28,000</p>
          </BreathingCard>
        </div>
      </div>
    </SlideContainer>
  );
}
