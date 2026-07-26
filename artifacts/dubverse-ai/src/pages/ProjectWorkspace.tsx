import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import {
  useGetProject,
  useGetUploadUrl,
  useAddVideoToProject,
  useReprocessTranscript,
  useCreateTranslation,
  useReprocessEmotions,
  useReprocessSpeakers,
  useGetProjectSpeakers,
  useUpdateSpeaker,
  useGenerateVoices,
  useGetVoiceAssets,
  useGenerateLipSync,
  useGetLipSyncAssets,
  useTriggerRender,
  useGetRenderedAssets,
  useTriggerExport,
  useGetExportAssets,
  useListGlossaries,
  useAddGlossaryTerm,
  useDeleteGlossaryTerm,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Play,
  Volume2,
  Subtitles,
  Download,
  Settings,
  RefreshCw,
  Loader2,
  Trash2,
  Sparkles,
  Smile,
  Mic,
  Languages,
  UserCheck,
  Video,
  FileCheck,
} from "lucide-react";

export default function ProjectWorkspace({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const [, setLocation] = useLocation();

  // 1. Backend REST API hooks
  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useGetProject(projectId);
  const getUploadUrlMutation = useGetUploadUrl();
  const addVideoMutation = useAddVideoToProject();

  // Pipeline triggers
  const transcribeMutation = useReprocessTranscript();
  const translateMutation = useCreateTranslation();
  const emotionsMutation = useReprocessEmotions();
  const speakersMutation = useReprocessSpeakers();
  const voicesMutation = useGenerateVoices();
  const lipsyncMutation = useGenerateLipSync();
  const renderMutation = useTriggerRender();
  const exportMutation = useTriggerExport();

  // Asset listings
  const { data: speakersList = [], refetch: refetchSpeakers } = useGetProjectSpeakers(projectId);
  const { data: voiceAssets = [], refetch: refetchVoices } = useGetVoiceAssets(projectId);
  const { data: lipsyncAssets = [], refetch: refetchLipsync } = useGetLipSyncAssets(projectId);
  const { data: renderedAssets = [], refetch: refetchRenders } = useGetRenderedAssets(projectId);
  const { data: exportAssets = [], refetch: refetchExports } = useGetExportAssets(projectId);

  // Glossary hooks
  const { data: glossaryTerms = [], refetch: refetchGlossary } = useListGlossaries(projectId);
  const addGlossaryMutation = useAddGlossaryTerm();
  const deleteGlossaryMutation = useDeleteGlossaryTerm();

  const updateSpeakerMutation = useUpdateSpeaker();

  // 2. Local UI states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeAudioTrack, setActiveAudioTrack] = useState<"original" | "dubbed">("original");
  const [activeVideoTrack, setActiveVideoTrack] = useState<"original" | "lipsynced" | "rendered">("original");
  const [hasWatermark, setHasWatermark] = useState(false);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [targetLang, setTargetLang] = useState("hi");

  // Glossary Form State
  const [gSource, setGSource] = useState("");
  const [gTarget, setGTarget] = useState("");

  // Edit Speaker state
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [editSpName, setEditSpName] = useState("");
  const [editSpGender, setEditSpGender] = useState("");
  const [editSpNotes, setEditSpNotes] = useState("");

  // Pipeline execution tracking states
  const [pipelineProgress, setPipelineProgress] = useState<Record<string, number>>({});
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);

  // 3. Socket.io Real-time integration
  useEffect(() => {
    const socketHost = window.location.origin.includes("localhost")
      ? "http://localhost:5000"
      : window.location.origin;

    logger("Connecting to Socket.io server at " + socketHost);
    const socket: Socket = io(socketHost, {
      auth: { token: localStorage.getItem("token") },
    });

    socket.on("connect", () => {
      logger("Socket connected. Subscribing to project room: " + projectId);
      socket.emit("subscribe", { projectId });
    });

    // Stage changes, generic job progress updates
    socket.on("job:stage_changed", (data: any) => {
      logger("Socket job:stage_changed event:", data);
      setPipelineStatus((prev) => ({ ...prev, [data.stage]: data.status }));
      setPipelineProgress((prev) => ({ ...prev, [data.stage]: data.progress }));
    });

    socket.on("job:progress", (data: any) => {
      setPipelineProgress((prev) => ({ ...prev, [data.stage]: data.progress }));
    });

    socket.on("job:completed", (data: any) => {
      setPipelineStatus((prev) => ({ ...prev, [data.stage]: "completed" }));
      setPipelineProgress((prev) => ({ ...prev, [data.stage]: 100 }));
      toast.success(`${data.stage} stage completed!`);
      // Refetch stats/assets
      refetchProject();
      refetchSpeakers();
      refetchVoices();
      refetchLipsync();
      refetchRenders();
      refetchExports();
    });

    socket.on("job:failed", (data: any) => {
      setPipelineStatus((prev) => ({ ...prev, [data.stage]: "failed" }));
      toast.error(`${data.stage} stage failed: ${data.error}`);
    });

    // Renders
    socket.on("render:progress", (data: any) => {
      setPipelineProgress((prev) => ({ ...prev, rendering: data.progress }));
    });
    socket.on("render:completed", () => {
      setPipelineStatus((prev) => ({ ...prev, rendering: "completed" }));
      setPipelineProgress((prev) => ({ ...prev, rendering: 100 }));
      refetchRenders();
    });

    // Exports
    socket.on("export:progress", (data: any) => {
      setPipelineProgress((prev) => ({ ...prev, export: data.progress }));
    });
    socket.on("export:completed", () => {
      setPipelineStatus((prev) => ({ ...prev, export: "completed" }));
      setPipelineProgress((prev) => ({ ...prev, export: 100 }));
      refetchExports();
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  function logger(msg: string, ...args: any[]) {
    console.log(`[ProjectWorkspace] ${msg}`, ...args);
  }

  // 4. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(10);
    try {
      // 1. Get presigned upload URL from backend
      const uploadDetails = await getUploadUrlMutation.mutateAsync({
        projectId,
        data: {
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
        },
      });

      setUploadProgress(40);

      // 2. Put file data directly to S3
      await fetch(uploadDetails.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setUploadProgress(80);

      // 3. Register uploaded video metadata
      await addVideoMutation.mutateAsync({
        projectId,
        data: {
          fileName: file.name,
          s3Key: uploadDetails.s3Key,
          durationSeconds: 10, // Mock metadata duration
          fileSize: file.size,
          mimeType: file.type,
        },
      });

      setUploadProgress(100);
      toast.success("Video uploaded and registered successfully!");
      refetchProject();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadProgress(null);
    }
  };

  // 5. Pipeline triggers
  const triggerSTT = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, "speech-to-text": "queued" }));
      await transcribeMutation.mutateAsync({ projectId });
      toast.success("Speech-to-Text transcription enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerTranslation = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, translation: "queued" }));
      await translateMutation.mutateAsync({ projectId, data: { targetLanguage: targetLang } });
      toast.success(`Translation to ${targetLang} enqueued`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerEmotion = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, "emotion-detection": "queued" }));
      await emotionsMutation.mutateAsync({ projectId });
      toast.success("Emotion Detection enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerSpeakers = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, "speaker-diarization": "queued" }));
      await speakersMutation.mutateAsync({ projectId });
      toast.success("Speaker Diarization enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerVoices = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, "voice-cloning": "queued" }));
      await voicesMutation.mutateAsync({ projectId });
      toast.success("Voice cloning & TTS synthesis enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerLipsync = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, "lip-sync": "queued" }));
      await lipsyncMutation.mutateAsync({ projectId });
      toast.success("AI Lip Sync matching enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerRendering = async () => {
    try {
      setPipelineStatus((prev) => ({ ...prev, rendering: "queued" }));
      await renderMutation.mutateAsync({
        projectId,
        data: {
          resolution: "1080p",
          format: "mp4",
          codec: "h264",
          hasSubtitles,
          hasWatermark,
        },
      });
      toast.success("Final video rendering enqueued");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerExport = async (type: "video_package" | "audio_only" | "subtitles" | "project_archive" | "metadata_json") => {
    try {
      setPipelineStatus((prev) => ({ ...prev, export: "queued" }));
      await exportMutation.mutateAsync({ projectId, data: { exportType: type } });
      toast.success(`Exporting ${type} package enqueued`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // 6. Speaker profile updates
  const handleUpdateSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpeakerId) return;
    try {
      await updateSpeakerMutation.mutateAsync({
        projectId,
        speakerId: selectedSpeakerId,
        data: {
          displayName: editSpName,
          gender: editSpGender,
          notes: editSpNotes,
        },
      });
      toast.success("Speaker profile updated");
      setSelectedSpeakerId("");
      refetchSpeakers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // 7. Glossary Actions
  const handleAddGlossary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gSource || !gTarget) return;
    try {
      await addGlossaryMutation.mutateAsync({
        projectId,
        data: {
          sourceText: gSource,
          targetText: gTarget,
          targetLanguage: targetLang,
        },
      });
      toast.success("Glossary term added");
      setGSource("");
      setGTarget("");
      refetchGlossary();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteGlossary = async (termId: string) => {
    try {
      await deleteGlossaryMutation.mutateAsync({ projectId, glossaryId: termId });
      toast.success("Glossary term deleted");
      refetchGlossary();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  const hasVideo = project?.videos && project.videos.length > 0;
  const currentVideo = hasVideo ? project.videos[0] : null;

  // Resolve active sources
  const originalVideoUrl = currentVideo ? currentVideo.s3Key : "";
  const lipsyncedVideoUrl = lipsyncAssets.length > 0 ? lipsyncAssets[0].downloadUrl : "";
  const renderedVideoUrl = renderedAssets.length > 0 ? renderedAssets[0].downloadUrl : "";

  const activeVideoUrl =
    activeVideoTrack === "rendered" && renderedVideoUrl
      ? renderedVideoUrl
      : activeVideoTrack === "lipsynced" && lipsyncedVideoUrl
      ? lipsyncedVideoUrl
      : originalVideoUrl;

  const dubbedAudioUrl = voiceAssets.find((a) => a.format === "wav")?.downloadUrl || "";

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/08 bg-white/02 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            className="text-white/40 hover:text-white rounded-lg hover:bg-white/05"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg leading-tight">{project?.name}</h1>
            <p className="text-[11px] text-white/30 tracking-wider uppercase mt-0.5">Project Studio</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {!hasVideo ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
          <Card className="bg-white/03 border-white/08 rounded-2xl p-12 text-center w-full shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-3 pb-6">
              <div className="w-16 h-16 rounded-full bg-violet-600/10 flex items-center justify-center mx-auto border border-violet-500/20">
                <Upload className="w-6 h-6 text-violet-400" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Upload original video</CardTitle>
              <CardDescription className="text-white/40 text-sm">
                Supported formats: MP4, MOV, WebM (up to 500MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {uploadProgress !== null ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Uploading direct to S3...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 bg-white/05 [&>div]:bg-violet-500" />
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-white/10 hover:border-violet-500/50 rounded-xl p-8 cursor-pointer transition-colors bg-white/02">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <span className="text-[13px] font-medium text-white/60">Click or drag files here to upload</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 max-w-7xl mx-auto w-full">
          {/* Left panel: Player and track settings */}
          <div className="lg:col-span-7 space-y-6 flex flex-col">
            <Card className="bg-white/03 border-white/08 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={activeVideoUrl}
                  controls
                  className="w-full h-full object-contain"
                />

                {/* Subtitle Display Overlay (if toggled and audio dubbed) */}
                {activeAudioTrack === "dubbed" && hasSubtitles && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded text-center max-w-[80%] text-sm text-yellow-300">
                    [Dubbed Translation Subtitles]
                  </div>
                )}
              </div>

              <CardContent className="p-6 space-y-6">
                {/* Audio and video tracks switcher */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[12px] font-medium text-white/50">Audio Track</Label>
                    <div className="grid grid-cols-2 gap-2 bg-white/05 rounded-xl p-1 border border-white/05">
                      <Button
                        variant={activeAudioTrack === "original" ? "default" : "ghost"}
                        onClick={() => setActiveAudioTrack("original")}
                        className={`rounded-lg py-2 text-[12px] ${activeAudioTrack === "original" ? "bg-white/10 hover:bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                      >
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" /> Original
                      </Button>
                      <Button
                        variant={activeAudioTrack === "dubbed" ? "default" : "ghost"}
                        disabled={!dubbedAudioUrl}
                        onClick={() => setActiveAudioTrack("dubbed")}
                        className={`rounded-lg py-2 text-[12px] ${activeAudioTrack === "dubbed" ? "bg-white/10 hover:bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                      >
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" /> Dubbed
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[12px] font-medium text-white/50">Video Render track</Label>
                    <div className="grid grid-cols-3 gap-1 bg-white/05 rounded-xl p-1 border border-white/05">
                      <Button
                        variant={activeVideoTrack === "original" ? "default" : "ghost"}
                        onClick={() => setActiveVideoTrack("original")}
                        className={`rounded-lg py-1 px-2 text-[10px] ${activeVideoTrack === "original" ? "bg-white/10 text-white" : "text-white/40"}`}
                      >
                        Original
                      </Button>
                      <Button
                        variant={activeVideoTrack === "lipsynced" ? "default" : "ghost"}
                        disabled={lipsyncAssets.length === 0}
                        onClick={() => setActiveVideoTrack("lipsynced")}
                        className={`rounded-lg py-1 px-2 text-[10px] ${activeVideoTrack === "lipsynced" ? "bg-white/10 text-white" : "text-white/40"}`}
                      >
                        Lip Synced
                      </Button>
                      <Button
                        variant={activeVideoTrack === "rendered" ? "default" : "ghost"}
                        disabled={renderedAssets.length === 0}
                        onClick={() => setActiveVideoTrack("rendered")}
                        className={`rounded-lg py-1 px-2 text-[10px] ${activeVideoTrack === "rendered" ? "bg-white/10 text-white" : "text-white/40"}`}
                      >
                        Rendered
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Subtitle & Watermark overlay configuration */}
                <div className="flex gap-6 border-t border-white/05 pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="burn-sub"
                      checked={hasSubtitles}
                      onCheckedChange={(checked) => setHasSubtitles(!!checked)}
                      className="border-white/20 data-[state=checked]:bg-violet-600"
                    />
                    <Label htmlFor="burn-sub" className="text-sm font-medium text-white/80 cursor-pointer">
                      Burn Subtitles
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="watermark"
                      checked={hasWatermark}
                      onCheckedChange={(checked) => setHasWatermark(!!checked)}
                      className="border-white/20 data-[state=checked]:bg-violet-600"
                    />
                    <Label htmlFor="watermark" className="text-sm font-medium text-white/80 cursor-pointer">
                      Add Watermark
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target language selector */}
            <Card className="bg-white/03 border-white/08 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium text-white/50">Target translation language</Label>
                  <Input
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    placeholder="hi, es, ta, fr"
                    className="bg-white/05 border-white/08 text-white rounded-xl max-w-[120px]"
                  />
                </div>
                <Button onClick={triggerTranslation} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl">
                  <Languages className="w-4 h-4 mr-2" /> Start Translation
                </Button>
              </div>
            </Card>
          </div>

          {/* Right panel: Tabs with details */}
          <div className="lg:col-span-5">
            <Tabs defaultValue="pipeline" className="w-full">
              <TabsList className="grid grid-cols-4 bg-white/05 rounded-xl p-1 border border-white/05 mb-6">
                <TabsTrigger value="pipeline" className="text-[11px] font-medium data-[state=active]:bg-white/10 rounded-lg">Pipeline</TabsTrigger>
                <TabsTrigger value="speakers" className="text-[11px] font-medium data-[state=active]:bg-white/10 rounded-lg">Speakers</TabsTrigger>
                <TabsTrigger value="glossary" className="text-[11px] font-medium data-[state=active]:bg-white/10 rounded-lg">Glossary</TabsTrigger>
                <TabsTrigger value="export" className="text-[11px] font-medium data-[state=active]:bg-white/10 rounded-lg">Export</TabsTrigger>
              </TabsList>

              {/* Pipeline Visualizer Tab */}
              <TabsContent value="pipeline" className="space-y-4">
                {[
                  { key: "speech-to-text", title: "Speech Recognition", icon: Play, action: triggerSTT },
                  { key: "translation", title: "Translation Engine", icon: Languages, action: triggerTranslation },
                  { key: "emotion-detection", title: "Emotion Detection", icon: Smile, action: triggerEmotion },
                  { key: "speaker-diarization", title: "Speaker Diarization", icon: UserCheck, action: triggerSpeakers },
                  { key: "voice-cloning", title: "Voice Cloning & TTS", icon: Mic, action: triggerVoices },
                  { key: "lip-sync", title: "AI Lip Sync", icon: Video, action: triggerLipsync },
                  { key: "rendering", title: "Video Rendering", icon: Settings, action: triggerRendering },
                ].map((stage) => {
                  const status = pipelineStatus[stage.key] || "idle";
                  const progress = pipelineProgress[stage.key] || 0;

                  return (
                    <Card key={stage.key} className="bg-white/02 border-white/05 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === "completed" ? "bg-green-500/10 text-green-400" : status === "processing" ? "bg-violet-500/10 text-violet-400" : "bg-white/05 text-white/40"}`}>
                          <stage.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white/90">{stage.title}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-white/30">{status}</span>
                          </div>
                          {status === "processing" && (
                            <Progress value={progress} className="h-1 bg-white/05 [&>div]:bg-violet-500" />
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={stage.action}
                        className="text-white/40 hover:text-white rounded-lg hover:bg-white/05"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </Card>
                  );
                })}
              </TabsContent>

              {/* Speakers Tab */}
              <TabsContent value="speakers" className="space-y-4">
                <Card className="bg-white/02 border-white/05 rounded-xl p-6">
                  <h3 className="font-bold text-sm mb-4">Diarized Speakers</h3>
                  {speakersList.length === 0 ? (
                    <p className="text-xs text-white/30">Trigger speaker diarization to discover voice profiles.</p>
                  ) : (
                    <div className="space-y-3">
                      {speakersList.map((sp) => (
                        <div
                          key={sp.id}
                          onClick={() => {
                            setSelectedSpeakerId(sp.id);
                            setEditSpName(sp.displayName);
                            setEditSpGender(sp.gender || "");
                            setEditSpNotes(sp.notes || "");
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedSpeakerId === sp.id ? "bg-violet-600/10 border-violet-500/30" : "bg-white/02 border-white/05 hover:bg-white/05"}`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white/80">{sp.displayName}</span>
                            <span className="text-[10px] text-white/40">Speaking time: {sp.totalSpeakingTime}s</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedSpeakerId && (
                    <form onSubmit={handleUpdateSpeaker} className="mt-6 border-t border-white/05 pt-4 space-y-3">
                      <h4 className="font-bold text-xs text-violet-400">Edit Speaker Profile</h4>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-white/40">Display Name</Label>
                        <Input
                          value={editSpName}
                          onChange={(e) => setEditSpName(e.target.value)}
                          className="bg-white/05 border-white/08 rounded-lg py-1.5 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-white/40">Gender</Label>
                        <Input
                          value={editSpGender}
                          onChange={(e) => setEditSpGender(e.target.value)}
                          placeholder="male, female"
                          className="bg-white/05 border-white/08 rounded-lg py-1.5 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-white/40">Notes</Label>
                        <Input
                          value={editSpNotes}
                          onChange={(e) => setEditSpNotes(e.target.value)}
                          className="bg-white/05 border-white/08 rounded-lg py-1.5 text-xs"
                        />
                      </div>
                      <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs py-2 mt-2">
                        Save Speaker
                      </Button>
                    </form>
                  )}
                </Card>
              </TabsContent>

              {/* Glossary Tab */}
              <TabsContent value="glossary" className="space-y-4">
                <Card className="bg-white/02 border-white/05 rounded-xl p-6">
                  <h3 className="font-bold text-sm mb-4">Glossary Substitutions</h3>
                  <form onSubmit={handleAddGlossary} className="grid grid-cols-2 gap-2 mb-6">
                    <Input
                      placeholder="Source text"
                      value={gSource}
                      onChange={(e) => setGSource(e.target.value)}
                      className="bg-white/05 border-white/08 rounded-lg py-1.5 text-xs"
                    />
                    <Input
                      placeholder="Target translation"
                      value={gTarget}
                      onChange={(e) => setGTarget(e.target.value)}
                      className="bg-white/05 border-white/08 rounded-lg py-1.5 text-xs"
                    />
                    <Button type="submit" className="col-span-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs">
                      Add glossary mapping
                    </Button>
                  </form>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {glossaryTerms.map((term) => (
                      <div key={term.id} className="flex items-center justify-between bg-white/02 border border-white/05 p-2 rounded-lg text-xs">
                        <span>{term.sourceText} &rarr; {term.targetText} ({term.targetLanguage})</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGlossary(term.id)}
                          className="text-white/40 hover:text-red-400 rounded-lg hover:bg-white/05 w-6 h-6"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Export Center Tab */}
              <TabsContent value="export" className="space-y-4">
                <Card className="bg-white/02 border-white/05 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-sm mb-2">Export Deliverables</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => triggerExport("video_package")} className="bg-white/05 hover:bg-white/10 text-white text-xs border border-white/08 py-5">
                      <Video className="w-3.5 h-3.5 mr-1.5" /> Video Package
                    </Button>
                    <Button onClick={() => triggerExport("audio_only")} className="bg-white/05 hover:bg-white/10 text-white text-xs border border-white/08 py-5">
                      <Volume2 className="w-3.5 h-3.5 mr-1.5" /> Audio Track
                    </Button>
                    <Button onClick={() => triggerExport("subtitles")} className="bg-white/05 hover:bg-white/10 text-white text-xs border border-white/08 py-5">
                      <Subtitles className="w-3.5 h-3.5 mr-1.5" /> Subtitle SRT
                    </Button>
                    <Button onClick={() => triggerExport("project_archive")} className="bg-white/05 hover:bg-white/10 text-white text-xs border border-white/08 py-5">
                      <FileCheck className="w-3.5 h-3.5 mr-1.5" /> Full Archive ZIP
                    </Button>
                  </div>

                  <div className="border-t border-white/05 pt-4 space-y-2 max-h-[220px] overflow-y-auto">
                    <h4 className="font-bold text-xs text-white/60 mb-2">Generated Packages</h4>
                    {exportAssets.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between bg-white/02 border border-white/05 p-3 rounded-lg text-xs">
                        <span className="font-bold text-white/80">{ex.format.toUpperCase()} Package ({Math.round(ex.fileSize / 1024)} KB)</span>
                        <a href={ex.downloadUrl} download className="text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
