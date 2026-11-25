export interface UpdatePillProps {
  /** Only true on the home screen (SPEC 3.10). */
  visible: boolean;
  needRefresh: boolean;
  onUpdate: () => void;
}

/** "Có bản mới · Cập nhật" pill (presentational; wired by UpdatePrompt). */
export function UpdatePill({ visible, needRefresh, onUpdate }: UpdatePillProps) {
  if (!visible || !needRefresh) return null;
  return (
    <button type="button" className="pill sun update-pill" onClick={onUpdate}>
      Có bản mới · Cập nhật
    </button>
  );
}
