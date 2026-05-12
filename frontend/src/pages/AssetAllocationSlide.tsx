import { SlideContainer } from '../components/layout/SlideContainer';
import { BreathingCard } from '../components/common/BreathingCard';

export function AssetAllocationSlide() {
  return (
    <SlideContainer title="资产配置" subtitle="大类资产分布与黄金占比">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">资产分布</h3>
          <div className="h-64 flex items-center justify-center text-ledger-muted">
            [饼图占位 - 现金/股票/房产/黄金/其他]
          </div>
        </BreathingCard>
        <BreathingCard>
          <h3 className="text-ledger-muted text-sm mb-4">黄金资产详情</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-ledger-muted">实物黄金</span>
              <span className="text-ledger-text font-mono">¥ 150,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">黄金ETF</span>
              <span className="text-ledger-text font-mono">¥ 80,000</span>
            </div>
            <div className="flex justify-between border-t border-ledger-bg pt-3">
              <span className="text-ledger-text font-medium">黄金总计</span>
              <span className="text-ledger-primary font-mono font-bold">¥ 230,000</span>
            </div>
          </div>
        </BreathingCard>
      </div>
    </SlideContainer>
  );
}
