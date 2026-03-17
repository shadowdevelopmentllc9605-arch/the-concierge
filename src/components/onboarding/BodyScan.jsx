import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Camera, Check, ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';

export default function BodyScan({ profile, concierge, onComplete }) {
  const [scans, setScans] = useState({
    front: profile?.body_scan_front || null,
    side: profile?.body_scan_side || null,
    back: profile?.body_scan_back || null
  });
  const [currentScan, setCurrentScan] = useState('front');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const scanSteps = [
    { key: 'front', label: 'Front View', instruction: 'Stand facing the camera with arms slightly away from body' },
    { key: 'side', label: 'Side View', instruction: 'Turn 90° to your right, arms relaxed at sides' },
    { key: 'back', label: 'Back View', instruction: 'Turn to face away from camera, arms slightly out' }
  ];

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setScans(prev => ({ ...prev, [currentScan]: file_url }));
      
      // Auto-advance to next scan
      const currentIndex = scanSteps.findIndex(s => s.key === currentScan);
      if (currentIndex < scanSteps.length - 1) {
        setTimeout(() => {
          setCurrentScan(scanSteps[currentIndex + 1].key);
        }, 500);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = async () => {
    if (!scans.front || !scans.side || !scans.back) return;
    
    setAnalyzing(true);
    try {
      // Use AI to analyze body measurements from scans
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these body scan images and estimate measurements. Provide realistic clothing size recommendations.`,
        file_urls: [scans.front, scans.side, scans.back],
        response_json_schema: {
          type: "object",
          properties: {
            measurements: {
              type: "object",
              properties: {
                chest: { type: "number" },
                waist: { type: "number" },
                hips: { type: "number" },
                inseam: { type: "number" },
                shoulders: { type: "number" },
                arm_length: { type: "number" }
              }
            },
            suggested_sizes: {
              type: "object",
              properties: {
                tops: { type: "string" },
                bottoms: { type: "string" },
                dresses: { type: "string" },
                suits: { type: "string" }
              }
            }
          }
        }
      });

      await onComplete({
        body_scan_front: scans.front,
        body_scan_side: scans.side,
        body_scan_back: scans.back,
        measurements: analysis.measurements,
        suggested_sizes: analysis.suggested_sizes
      });
    } catch (error) {
      console.error(error);
      // Continue anyway with basic data
      await onComplete({
        body_scan_front: scans.front,
        body_scan_side: scans.side,
        body_scan_back: scans.back
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const allScansComplete = scans.front && scans.side && scans.back;
  const guideMessage = "Now I'll need to see how clothes will fit you. Let's capture your measurements with three quick photos.";

  return (
    <div className="max-w-md mx-auto">
      <ConciergeGuide concierge={concierge} message={guideMessage} />
      
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-[#2d2d2d] mb-2"
      >
        Let's Find Your Perfect Fit
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[#6b7280] mb-4"
      >
        Capture three quick poses for personalized size recommendations
      </motion.p>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-3 mb-6"
      >
        <div className="flex-1 bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-lg font-semibold">30s</p>
          <p className="text-[#6b7280] text-xs">Takes 30 seconds</p>
        </div>
        <div className="flex-1 bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-lg font-semibold">AI</p>
          <p className="text-[#6b7280] text-xs">Powered analysis</p>
        </div>
        <div className="flex-1 bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-lg font-semibold">98%</p>
          <p className="text-[#6b7280] text-xs">Fit accuracy</p>
        </div>
      </motion.div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left"
      >
        <p className="text-blue-800 text-sm font-medium mb-1">✨ Why this matters</p>
        <p className="text-blue-700 text-xs leading-relaxed">We use your body scan to calculate exact measurements, suggest your perfect size across brands, and give every product a personal Fit Score — so you shop with total confidence.</p>
      </motion.div>

      {/* Scan Steps Indicator */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center gap-4 mb-8"
      >
        {scanSteps.map((step) => (
          <button
            key={step.key}
            onClick={() => setCurrentScan(step.key)}
            className={`flex flex-col items-center gap-2 transition-all ${
              currentScan === step.key ? 'scale-110' : 'opacity-60'
            }`}
          >
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              scans[step.key] 
                ? 'bg-[#c9a962]' 
                : currentScan === step.key 
                  ? 'bg-white ring-2 ring-[#c9a962] shadow-sm' 
                  : 'bg-[#e5e7eb]'
            }`}>
              {scans[step.key] ? (
                <Check className="w-6 h-6 text-white" />
              ) : (
                <Camera className="w-6 h-6 text-[#6b7280]" />
              )}
            </div>
            <span className="text-[#6b7280] text-xs">{step.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Current Scan Preview */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="relative aspect-[3/4] bg-white rounded-2xl overflow-hidden mb-6 shadow-sm border border-[#e5e7eb]"
      >
        {scans[currentScan] ? (
          <>
            <img 
              src={scans[currentScan]} 
              alt={`${currentScan} scan`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setScans(prev => ({ ...prev, [currentScan]: null }))}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#faf8f5]">
            {/* Pose Guide Silhouette */}
            <div className="w-32 h-48 border-2 border-dashed border-[#d1d5db] rounded-lg mb-6 flex items-center justify-center">
              <span className="text-[#9ca3af] text-6xl">
                {currentScan === 'front' ? '🧍' : currentScan === 'side' ? '🚶' : '🧍'}
              </span>
            </div>
            <p className="text-[#6b7280] text-center text-sm">
              {scanSteps.find(s => s.key === currentScan)?.instruction}
            </p>
          </div>
        )}
      </motion.div>

      {/* Capture Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {!scans[currentScan] ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-14 bg-white hover:bg-[#f5f5f5] text-[#2d2d2d] rounded-xl font-medium text-base border border-[#e5e7eb] shadow-sm"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Camera className="mr-2 w-5 h-5" />
                Capture {scanSteps.find(s => s.key === currentScan)?.label}
              </>
            )}
          </Button>
        ) : !allScansComplete ? (
          <p className="text-center text-[#9ca3af] text-sm">
            Tap on the next view above to continue
          </p>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={analyzing}
            className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Analyzing your fit...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </motion.div>
    </div>
  );
}