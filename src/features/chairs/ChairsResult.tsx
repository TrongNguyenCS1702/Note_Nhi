import type { StudentRow } from '@/domain/schemas';
import { Button, Card, Eyebrow, Mascot, Overlay, Starburst } from '@/ui';

export interface ChairsResultProps {
  classLabel: string | null;
  winners: readonly StudentRow[];
  onContinue: () => void;
  onReroll: () => void;
  onAbsent: () => void;
}

/** Result overlay: big display name(s) on sun/pink stickers, full names below (mockup #chair-result). */
export function ChairsResult({ classLabel, winners, onContinue, onReroll, onAbsent }: ChairsResultProps) {
  const cls = (classLabel ?? '').replace(/^Lớp\s+/i, '');
  return (
    <Overlay label="Kết quả ghế âm nhạc">
      <Card>
        <Eyebrow>
          Lớp <b className="cls">{cls}</b> · Mời lên sân khấu
        </Eyebrow>
        <div className="result-stage">
          <Starburst />
          <Mascot mood="cheer" size="clamp(100px,12vw,170px)" />
          <div className="result-names">
            {winners.map((s) => (
              <span key={s.id}>{s.displayName}</span>
            ))}
          </div>
        </div>
        <p className="result-sub">{winners.map((s) => s.fullName).join(' & ')}</p>
        <div className="row">
          <Button primary big kbd="Space" onClick={onContinue}>
            Tiếp tục
          </Button>
          <Button big kbd="R" onClick={onReroll}>
            Quay lại
          </Button>
          {winners.length === 1 && (
            <Button big kbd="V" onClick={onAbsent}>
              Bạn này vắng
            </Button>
          )}
        </div>
      </Card>
    </Overlay>
  );
}
