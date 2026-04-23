import { motion } from 'motion/react';
import pomodoroImage from '../assets/pomodoro.png';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-3xl"
    >
      <div className="flex flex-col items-center gap-6">
        <motion.img
          src={pomodoroImage}
          alt="Pomodoro"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-[120px] h-[120px] sm:w-[144px] sm:h-[144px] select-none pointer-events-none object-contain drop-shadow-md"
        />
        <div className="spinner-ring" />
      </div>
    </motion.div>
  );
}
