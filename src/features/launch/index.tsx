import { ph } from '@/app/placeholders';
export const LaunchScreen = ph('Chơi gì đây ta?', 'Chọn hoạt động', [
  { to: 'chairs', label: 'Ghế âm nhạc', kbd: '1' },
  { to: 'silence', label: 'Thử thách im lặng', kbd: '2' },
  { to: 'wait', label: 'Màn hình chờ', kbd: '3' },
  { to: 'prep', label: 'Sửa điểm danh', kbd: 'D' },
]);
