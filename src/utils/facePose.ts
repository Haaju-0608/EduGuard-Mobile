export type FaceAngleKey = 'front' | 'left' | 'right';

// Tỉ lệ khoảng cách mũi→mép trái / mũi→mép phải (landmark MediaPipe FaceLandmarker, xem
// PoseCheckWebView) — ~1 nghĩa là mặt đối xứng (nhìn thẳng); càng lệch xa 1 càng chứng tỏ đã quay
// đầu rõ rệt. Đặt tương đối rộng để tránh chặn nhầm ảnh hợp lệ (false reject) — cần tinh chỉnh thêm
// sau khi test trên máy thật với nhiều khuôn mặt/ánh sáng khác nhau.
const FRONT_MAX_ASYMMETRY = 1.67; // front hợp lệ nếu ratio trong [1/1.67, 1.67] (~lệch dưới 40%)
const TURN_MIN_ASYMMETRY = 1.8;   // left/right hợp lệ nếu ratio > 1.8 hoặc < 1/1.8 (~lệch trên 45%)

export function isPoseValidForAngle(angle: FaceAngleKey, ratio: number): boolean {
  if (angle === 'front') {
    return ratio >= 1 / FRONT_MAX_ASYMMETRY && ratio <= FRONT_MAX_ASYMMETRY;
  }
  return ratio >= TURN_MIN_ASYMMETRY || ratio <= 1 / TURN_MIN_ASYMMETRY;
}

export function poseWarningMessage(angle: FaceAngleKey): string {
  if (angle === 'front') {
    return "This looks like your head is turned to one side. For the Front photo, please face the camera directly.";
  }
  return `This looks like you're facing the camera directly. For this photo, please turn your head clearly to the ${angle}.`;
}
