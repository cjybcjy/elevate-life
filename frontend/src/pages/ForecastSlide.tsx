import { SlideContainer } from '../components/layout/SlideContainer';
import { BreathingCard } from '../components/common/BreathingCard';
import { AmountDisplay } from '../components/common/AmountDisplay';

export function ForecastSlide() {
  return (
    <SlideContainer title="财务预测" subtitle="基于当前数据的未来财务模拟">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">净值预测</h3>
          <div className="h-64 flex items-center justify-center text-ledger-muted">
            [预测曲线占位 - 未来12个月净值走势]
          </div>
        </BreathingCard>
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">关键预测指标</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-ledger-bg rounded-lg">
              <span className="text-ledger-muted">预计还清贷款</span>
              <span className="text-ledger-text font-mono">2028年6月</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-ledger-bg rounded-lg">
              <span className="text-ledger-muted">12个月后净值</span>
              <AmountDisplay amount={2100000} className="text-ledger-primary font-bold" />
            </div>
            <div className="flex justify-between items-center p-3 bg-ledger-bg rounded-lg">
              <span className="text-ledger-muted">储蓄率</span>
              <span className="text-ledger-success font-mono">37.8%</span>
            </div>
          </div>
        </BreathingCard>
      </div>
    </SlideContainer>
  );
}
