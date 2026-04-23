import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Brain, Coffee, Bed, Volume2, VolumeX, Sparkles, Settings, X, SkipForward } from 'lucide-react';
import bgImage from '../assets/bg.png';
import pomodoroImage from '../assets/pomodoro.png';
import soundBell from '../sounds/bell.wav';
import soundBlip from '../sounds/blip.wav';
import soundChime from '../sounds/chime.wav';
import soundSoftBlip from '../sounds/soft blip.wav';
import SplashScreen from './SplashScreen';

export type Mode = 'pomodoro' | 'shortBreak' | 'longBreak';
type ChimeType = 'bell' | 'blip' | 'chime' | 'softBlip';

const CHIME_OPTIONS: { value: ChimeType, label: string, src: string }[] = [
  { value: 'bell', label: 'Bell', src: soundBell },
  { value: 'blip', label: 'Blip', src: soundBlip },
  { value: 'chime', label: 'Chime', src: soundChime },
  { value: 'softBlip', label: 'Soft Blip', src: soundSoftBlip }
];

const THEMES = {
  pomodoro: {
    bg: '#FDF7F3',
    primary: '#E06B53',
    card: 'rgba(255, 255, 255, 0.75)',
    text: '#4A342E',
    textMuted: '#A89288',
    subtext: 'Stay focused',
  },
  shortBreak: {
    bg: '#F3F8F2',
    primary: '#6BA374',
    card: 'rgba(255, 255, 255, 0.75)',
    text: '#2D4530',
    textMuted: '#8FAD95',
    subtext: 'Take a breath',
  },
  longBreak: {
    bg: '#F2F6FC',
    primary: '#6A8BBA',
    card: 'rgba(255, 255, 255, 0.75)',
    text: '#2B3C57',
    textMuted: '#93A4B8',
    subtext: 'Rest well',
  }
};

const TIMER_WORKER_CODE = `
let intervalId = null;
let endTime = 0;
let phaseCompleteSent = false;

self.onmessage = function(e) {
  if (e.data.cmd === 'start') {
    endTime = e.data.endTime;
    phaseCompleteSent = false;
    clearInterval(intervalId);
    intervalId = setInterval(function() {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((endTime - now) / 1000));
      if (remaining <= 0 && !phaseCompleteSent) {
        phaseCompleteSent = true;
        self.postMessage({ type: 'phase-complete' });
      }
      self.postMessage({ type: 'tick', remaining: remaining });
    }, 200);
  } else if (e.data.cmd === 'stop') {
    clearInterval(intervalId);
    intervalId = null;
  }
};
`;

function getDurationForMode(m: Mode, pomodoroDuration: number, shortBreakDuration: number, longBreakDuration: number) {
  if (m === 'pomodoro') return pomodoroDuration * 60;
  if (m === 'shortBreak') return shortBreakDuration * 60;
  return longBreakDuration * 60;
}

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const images = [bgImage, pomodoroImage];
    let loaded = 0;
    const total = images.length;

    if (total === 0) {
      const t = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(t);
    }

    images.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= total) {
          setTimeout(() => setLoading(false), 300);
        }
      };
      img.src = src;
    });
  }, []);

  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('pomodoroDuration');
    return saved ? parseInt(saved, 10) : 25;
  });
  const [shortBreakDuration, setShortBreakDuration] = useState(() => {
    const saved = localStorage.getItem('shortBreakDuration');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [longBreakDuration, setLongBreakDuration] = useState(() => {
    const saved = localStorage.getItem('longBreakDuration');
    return saved ? parseInt(saved, 10) : 15;
  });
  const [chimeType, setChimeType] = useState<ChimeType>(() => {
    return (localStorage.getItem('chimeType') as ChimeType) || 'bell';
  });
const [sessionsUntilLongBreak, setSessionsUntilLongBreak] = useState(() => {
  const saved = localStorage.getItem('sessionsUntilLongBreak');
  return saved ? parseInt(saved, 10) : 4;
});
const [autoNextPhase, setAutoNextPhase] = useState(() => {
  const saved = localStorage.getItem('autoNextPhase');
  return saved ? JSON.parse(saved) : false;
});

  const [showSettings, setShowSettings] = useState(false);

useEffect(() => {
localStorage.setItem('pomodoroDuration', pomodoroDuration.toString());
localStorage.setItem('shortBreakDuration', shortBreakDuration.toString());
localStorage.setItem('longBreakDuration', longBreakDuration.toString());
localStorage.setItem('chimeType', chimeType);
localStorage.setItem('sessionsUntilLongBreak', sessionsUntilLongBreak.toString());
localStorage.setItem('autoNextPhase', JSON.stringify(autoNextPhase));
}, [pomodoroDuration, shortBreakDuration, longBreakDuration, chimeType, sessionsUntilLongBreak, autoNextPhase]);

  const MODES: Record<Mode, { label: string; time: number; icon: React.ElementType }> = {
    pomodoro: { label: 'Focus', time: pomodoroDuration * 60, icon: Brain },
    shortBreak: { label: 'Short break', time: shortBreakDuration * 60, icon: Coffee },
    longBreak: { label: 'Long break', time: longBreakDuration * 60, icon: Bed },
  };

  const [mode, setMode] = useState<Mode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(MODES.pomodoro.time);
  const [isActive, setIsActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);

  const endTimeRef = useRef<number>(0);
  const audioUnlockedRef = useRef(false);
  const preloadedAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const phaseCompletedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const isActiveRef = useRef(false);

const modeRef = useRef(mode);
const cycleCountRef = useRef(cycleCount);
const sessionsUntilLongBreakRef = useRef(sessionsUntilLongBreak);
const soundEnabledRef = useRef(soundEnabled);
const chimeTypeRef = useRef(chimeType);
const autoNextPhaseRef = useRef(autoNextPhase);

modeRef.current = mode;
cycleCountRef.current = cycleCount;
sessionsUntilLongBreakRef.current = sessionsUntilLongBreak;
soundEnabledRef.current = soundEnabled;
chimeTypeRef.current = chimeType;
isActiveRef.current = isActive;
autoNextPhaseRef.current = autoNextPhase;

  useEffect(() => {
    CHIME_OPTIONS.forEach(opt => {
      const audio = new Audio(opt.src);
      audio.preload = 'auto';
      preloadedAudioRef.current.set(opt.value, audio);
    });
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    const audio = preloadedAudioRef.current.get(chimeTypeRef.current);
    if (audio) {
      const originalVolume = audio.volume;
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = originalVolume;
        audioUnlockedRef.current = true;
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (mode === 'pomodoro') setTimeLeft(pomodoroDuration * 60);
      else if (mode === 'shortBreak') setTimeLeft(shortBreakDuration * 60);
      else if (mode === 'longBreak') setTimeLeft(longBreakDuration * 60);
    }
  }, [pomodoroDuration, shortBreakDuration, longBreakDuration, mode]);

  const playChime = useCallback((overrideType?: ChimeType) => {
    if (!soundEnabledRef.current) return;
    const typeToPlay = overrideType || chimeTypeRef.current;
    const audio = preloadedAudioRef.current.get(typeToPlay);
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1;
      audio.play().catch(() => {});
    } else {
      const soundOption = CHIME_OPTIONS.find(opt => opt.value === typeToPlay);
      if (soundOption) {
        const fallbackAudio = new Audio(soundOption.src);
        fallbackAudio.play().catch(() => {});
      }
    }
  }, []);

  const changeMode = useCallback((newMode: Mode) => {
    setMode(newMode);
    setIsActive(false);
    phaseCompletedRef.current = false;
    const duration = getDurationForMode(newMode, pomodoroDuration, shortBreakDuration, longBreakDuration);
    setTimeLeft(duration);
    endTimeRef.current = 0;
  }, [pomodoroDuration, shortBreakDuration, longBreakDuration]);

const handleNextPhase = useCallback((manualSkip = false) => {
setIsActive(false);
phaseCompletedRef.current = false;
endTimeRef.current = 0;
if (!manualSkip) playChime();

const currentMode = modeRef.current;
const currentCycleCount = cycleCountRef.current;
const currentSessions = sessionsUntilLongBreakRef.current;

if (currentMode === 'pomodoro') {
const newCount = currentCycleCount + 1;
setCycleCount(newCount);
const nextMode = (newCount % currentSessions === 0) ? 'longBreak' : 'shortBreak';
changeMode(nextMode);
if (autoNextPhaseRef.current) {
setTimeout(() => setIsActive(true), 500);
}
} else {
changeMode('pomodoro');
if (autoNextPhaseRef.current) {
setTimeout(() => setIsActive(true), 500);
}
}
}, [playChime, changeMode]);

  useEffect(() => {
    if (!isActive) {
      if (workerRef.current) {
        workerRef.current.postMessage({ cmd: 'stop' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    phaseCompletedRef.current = false;

    const duration = getDurationForMode(mode, pomodoroDuration, shortBreakDuration, longBreakDuration);
    const endTime = Date.now() + timeLeft * 1000;
    endTimeRef.current = endTime;

    const blob = new Blob([TIMER_WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data.type === 'tick') {
        setTimeLeft(data.remaining);
      } else if (data.type === 'phase-complete') {
        if (!phaseCompletedRef.current) {
          phaseCompletedRef.current = true;
          handleNextPhase(false);
        }
      }
    };

    worker.postMessage({ cmd: 'start', endTime });
    unlockAudio();

    return () => {
      worker.postMessage({ cmd: 'stop' });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
    };
  }, [isActive]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current && !phaseCompletedRef.current) {
        const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0 && !phaseCompletedRef.current) {
          phaseCompletedRef.current = true;
          handleNextPhase(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [handleNextPhase]);

  // Update document title
  useEffect(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.title = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${MODES[mode].label}`;
  }, [timeLeft, mode]);

  const toggleTimer = () => {
    if (!isActive) {
      unlockAudio();
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    phaseCompletedRef.current = false;
    endTimeRef.current = 0;
    setTimeLeft(MODES[mode].time);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentTheme = THEMES[mode];
  const progress = ((MODES[mode].time - timeLeft) / MODES[mode].time) * 100;
  
  const radius = 240; // Moved closer to the edge
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <>
    <AnimatePresence>
      {loading && <SplashScreen key="splash" />}
    </AnimatePresence>

    <motion.div 
      initial={false}
      animate={{ color: currentTheme.text }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
    >
      {/* Uploaded Background Image */}
      <img 
        src={bgImage} 
        referrerPolicy="no-referrer"
        alt="Cozy ambient background" 
        className="app-bg-image absolute inset-0 w-full h-full select-none pointer-events-none" 
      />

      {/* Theme Tint Overlay */}
      <motion.div 
        className="absolute inset-0 z-0 mix-blend-multiply opacity-20 sm:opacity-40 pointer-events-none"
        animate={{ backgroundColor: currentTheme.bg }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />

      {/* Background Ambience effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-0">
          <motion.div 
             animate={{ backgroundColor: currentTheme.primary }}
             transition={{ duration: 2 }}
             className="w-[80vw] h-[80vw] sm:w-[60vw] sm:h-[60vw] rounded-full blur-[100px] sm:blur-[140px] opacity-[0.08] absolute mix-blend-multiply"
          />
      </div>

      <motion.div 
         className="relative z-10 w-full max-w-[500px] flex flex-col items-center -mt-[4vh] sm:-mt-[8vh]"
      >
         {/* App Header */}
         <div className="flex flex-col items-center justify-center mb-4 sm:mb-8">
            <img src={pomodoroImage} alt="Pomodoro" className="w-[120px] h-[120px] sm:w-[144px] sm:h-[144px] drop-shadow-md select-none pointer-events-none object-contain z-10" />
            <div className="font-display font-semibold text-2xl sm:text-3xl tracking-tight text-[#5A433A]/85 select-none -mt-4 sm:-mt-6 relative z-0">
               Pomodoro timer
            </div>
         </div>

         {/* Giant Circular Timer */}
         <motion.div
            animate={{ backgroundColor: currentTheme.card }}
            transition={{ duration: 0.8 }}
            className="relative w-[85vw] h-[85vw] max-w-[380px] max-h-[380px] sm:max-w-[480px] sm:max-h-[480px] rounded-full backdrop-blur-2xl border border-white/60 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1),inset_0_4px_24px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center shrink-0 mb-8 sm:mb-10"
         >
            {/* Progress SVG */}
            <svg viewBox="0 0 500 500" className="-rotate-90 absolute inset-0 w-full h-full drop-shadow-sm pointer-events-none">
                {/* Track */}
                <circle
                   cx="250" cy="250" r={radius}
                   className="stroke-black/[0.04] fill-none"
                   strokeWidth="12"
                />
                {/* Progress Line */}
                <motion.circle
                   cx="250" cy="250" r={radius}
                   className="fill-none"
                   strokeWidth="14"
                   strokeLinecap="round"
                   initial={{ strokeDashoffset: circumference }}
                   animate={{ stroke: currentTheme.primary, strokeDashoffset }}
                   style={{ strokeDasharray: circumference }}
                   transition={{ 
                     strokeDashoffset: { duration: 1, ease: 'linear' },
                     stroke: { duration: 0.8 } 
                   }}
                />
            </svg>

            {/* Inner Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">

                {/* Time Text */}
                <div className="flex flex-col items-center mb-4 sm:mb-8">
                    <span className="font-display font-medium text-[18vw] sm:text-[6.75rem] leading-[0.9] tracking-tight tabular-nums mix-blend-multiply opacity-80 select-none">
                       {formatTime(timeLeft)}
                    </span>
                    <motion.span
                       animate={{ color: currentTheme.text }}
                       className="text-sm sm:text-lg font-medium opacity-80 mt-1 sm:mt-2 tracking-wide text-center"
                    >
                       {currentTheme.subtext}
                    </motion.span>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                        <button 
                           onClick={resetTimer}
                           className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/50 backdrop-blur-md hover:bg-white/80 active:bg-white border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex items-center justify-center transition-all group outline-none"
                           aria-label="Reset timer"
                        >
                           <RotateCcw className="w-6 h-6 opacity-60 group-hover:opacity-100 group-active:-rotate-180 transition-all duration-500" style={{ color: currentTheme.text }} />
                        </button>
                        
                        <motion.button 
                           animate={{ backgroundColor: currentTheme.primary, color: '#fff' }}
                           transition={{ backgroundColor: { duration: 0.8 } }}
                           whileHover={{ scale: 1.05 }}
                           whileTap={{ scale: 0.95 }}
                           onClick={toggleTimer}
                           className="w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-[0_16px_32px_-8px_rgba(0,0,0,0.15)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)] flex items-center justify-center transition-shadow border border-white/20 outline-none"
                           aria-label={isActive ? "Pause timer" : "Start timer"}
                        >
                           {isActive ? (
                              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-0.5" />
                           ) : (
                              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1.5 sm:ml-2" />
                           )}
                        </motion.button>

                        <button 
                           onClick={() => handleNextPhase(true)}
                           className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/50 backdrop-blur-md hover:bg-white/80 active:bg-white border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex items-center justify-center transition-all group outline-none"
                           aria-label="Skip phase"
                        >
                           <SkipForward className="w-6 h-6 opacity-60 group-hover:opacity-100 group-active:translate-x-1 transition-all duration-500" style={{ color: currentTheme.text }} />
                        </button>
                    </div>

                    {/* Secondary Controls (Settings & Sound) */}
                    <div className="flex items-center justify-center gap-6 mt-[-4px] sm:mt-[-8px]">
                        <button 
                           onClick={() => setSoundEnabled(!soundEnabled)}
                           className="p-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors opacity-50 hover:opacity-100 outline-none group"
                           aria-label="Toggle sound"
                        >
                           {soundEnabled ? (
                             <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform duration-500" style={{ color: currentTheme.text }} />
                           ) : (
                             <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform duration-500" style={{ color: currentTheme.text }} />
                           )}
                        </button>

                        <button 
                           onClick={() => setShowSettings(true)}
                           className="p-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors opacity-50 hover:opacity-100 outline-none group"
                           aria-label="Settings"
                        >
                           <Settings className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform duration-500" style={{ color: currentTheme.text }} />
                        </button>
                    </div>
                </div>

            </div>
</motion.div>

      {/* Mode Selector Badge underneath the circle */}
         <div className="flex w-[85vw] max-w-[340px] sm:max-w-[420px] space-x-1 bg-white/50 backdrop-blur-md rounded-full shadow-lg border border-white/50 p-1.5 shrink-0 z-20">
            {(Object.keys(MODES) as Mode[]).map((m) => {
               const Icon = MODES[m].icon;
               const isActiveMode = mode === m;
               return (
                  <button
                     key={m}
                     onClick={() => changeMode(m)}
                     className="relative flex-1 py-2 sm:py-2.5 rounded-full flex items-center justify-center gap-2 font-bold text-[10px] sm:text-xs tracking-wider uppercase outline-none group"
                  >
                     {isActiveMode && (
                        <motion.div 
                           layoutId="activeMode"
                           className="absolute inset-0 bg-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-black/[0.02]"
                           transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                     )}
                     <span 
                       className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 transition-colors duration-300 w-full" 
                       style={{ color: isActiveMode ? currentTheme.primary : currentTheme.textMuted }}
                     >
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${!isActiveMode && "group-hover:scale-110 transition-transform"}`} />
                        <span className={`truncate ${isActiveMode ? 'block' : 'hidden sm:block'}`}>{MODES[m].label}</span>
                     </span>
                  </button>
               )
            })}
         </div>
      </motion.div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white/90 backdrop-blur-xl border border-white p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col gap-6"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100/50"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-gray-800 tracking-tight">Settings</h2>
              
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-600">Focus Duration (minutes)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="5" max="60" step="5"
                      value={pomodoroDuration}
                      onChange={(e) => setPomodoroDuration(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#E06B53]"
                    />
                    <input
                      type="number" min="5" max="60"
                      value={pomodoroDuration}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value === '' || v < 5) setPomodoroDuration(5);
                        else if (v > 60) setPomodoroDuration(60);
                        else setPomodoroDuration(v);
                      }}
                      className="font-mono font-medium text-lg text-gray-700 w-14 text-right bg-transparent border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#E06B53]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-600">Short Break (minutes)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="1" max="15" step="1"
                      value={shortBreakDuration}
                      onChange={(e) => setShortBreakDuration(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#6BA374]"
                    />
                    <input
                      type="number" min="1" max="15"
                      value={shortBreakDuration}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value === '' || v < 1) setShortBreakDuration(1);
                        else if (v > 15) setShortBreakDuration(15);
                        else setShortBreakDuration(v);
                      }}
                      className="font-mono font-medium text-lg text-gray-700 w-14 text-right bg-transparent border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#6BA374]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-600">Long Break (minutes)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="5" max="30" step="5"
                      value={longBreakDuration}
                      onChange={(e) => setLongBreakDuration(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#6A8BBA]"
                    />
                    <input
                      type="number" min="5" max="30"
                      value={longBreakDuration}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value === '' || v < 5) setLongBreakDuration(5);
                        else if (v > 30) setLongBreakDuration(30);
                        else setLongBreakDuration(v);
                      }}
                      className="font-mono font-medium text-lg text-gray-700 w-14 text-right bg-transparent border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#6A8BBA]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-600">Sessions until Long Break</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="1" max="10" step="1"
                      value={sessionsUntilLongBreak}
                      onChange={(e) => setSessionsUntilLongBreak(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#E06B53]"
                    />
                    <input
                      type="number" min="1" max="10"
                      value={sessionsUntilLongBreak}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value === '' || v < 1) setSessionsUntilLongBreak(1);
                        else if (v > 10) setSessionsUntilLongBreak(10);
                        else setSessionsUntilLongBreak(v);
                      }}
                      className="font-mono font-medium text-lg text-gray-700 w-14 text-right bg-transparent border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#E06B53]"
                    />
                  </div>
                </div>

<div className="w-full h-px bg-gray-100 my-1" />

<div className="flex items-center justify-between py-2">
<span className="text-sm font-medium text-gray-600">Auto next phase</span>
<button
onClick={() => setAutoNextPhase(!autoNextPhase)}
className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
autoNextPhase ? 'bg-[#E06B53]' : 'bg-gray-300'
}`}
>
<div
className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
autoNextPhase ? 'left-6' : 'left-1'
}`}
/>
</button>
</div>

<div className="flex flex-col gap-2">
<label className="text-sm font-medium text-gray-600 mb-1">Alarm Sound</label>
<div className="grid grid-cols-2 gap-2">
{CHIME_OPTIONS.map((option) => (
<button
key={option.value}
onClick={() => {
setChimeType(option.value);
if (!soundEnabled) setSoundEnabled(true);
playChime(option.value);
}}
className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors border ${
chimeType === option.value
? 'bg-gray-800 text-white border-gray-800'
: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
}`}
>
{option.label}
</button>
))}
</div>
</div>
</div>

              <div className="pt-2">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 rounded-full bg-[#E06B53] hover:bg-[#c95b45] text-white font-medium tracking-wide transition-colors shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
     </motion.div>

     <footer className="fixed bottom-3 left-0 right-0 text-center text-xs text-[#5A433A]/50 font-display select-none z-10">
       Сделано <a href="https://minti-dev.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-[#E06B53] transition-colors">Minti</a>
     </footer>
     </>
   );
 }
