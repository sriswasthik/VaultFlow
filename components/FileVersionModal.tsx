
import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, RotateCcw, Clock, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

interface FileVersion {
  id: string;
  name: string;
  size: number;
  type: string;
  storagePath: string;
  downloadURL: string;
  archivedAt: Timestamp;
}

interface FileVersionModalProps {
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    mimeType: string;
    storagePath: string;
    downloadURL: string;
  } | null;
  userId: string;
  onClose: () => void;
}

const FileVersionModal: React.FC<FileVersionModalProps> = ({ file, userId, onClose }) => {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file || !userId) return;

    const storageKey = `vaultflow_versions_${userId}_${file.id}`;
    const localData = localStorage.getItem(storageKey);
    try {
      setVersions(localData ? JSON.parse(localData) : []);
    } catch {
      setVersions([]);
    }
    setIsLoading(false);
  }, [file, userId]);

  const archiveCurrentFile = async () => {
    if (!file) return;
    const storageKey = `vaultflow_versions_${userId}_${file.id}`;
    const currentVersionsRaw = localStorage.getItem(storageKey);
    let currentVersions: FileVersion[] = [];
    try {
      currentVersions = currentVersionsRaw ? JSON.parse(currentVersionsRaw) : [];
    } catch {}

    const archivedVer: FileVersion = {
      id: 'version_' + Date.now().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      storagePath: file.storagePath,
      downloadURL: file.downloadURL,
      archivedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
    };

    const nextVersions = [archivedVer, ...currentVersions];
    setVersions(nextVersions);
    localStorage.setItem(storageKey, JSON.stringify(nextVersions));
  };

  const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!file || !e.target.files || !e.target.files[0]) return;
    
    const newFile = e.target.files[0];
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // 1. Archive current version
      await archiveCurrentFile();

      // Simulate download URL and progress
      const uniqueId = Date.now();
      let currentProgress = 0;
      
      const interval = setInterval(() => {
        currentProgress += 20;
        setUploadProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          
          let downloadURL = '#';
          if (newFile.type.includes('image')) {
            downloadURL = 'https://images.unsplash.com/photo-1614064641938-3e8529437109?auto=format&fit=crop&q=80&w=2000';
          } else if (newFile.type.includes('pdf')) {
            downloadURL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
          }

          // Handle main file document update in localStorage
          const mainFilesKey = `vaultflow_files_${userId}`;
          const currentFilesRaw = localStorage.getItem(mainFilesKey);
          if (currentFilesRaw) {
            try {
              const parsed = JSON.parse(currentFilesRaw);
              const next = parsed.map((f: any) => f.id === file.id ? {
                ...f,
                name: newFile.name,
                size: newFile.size,
                mimeType: newFile.type,
                storagePath: `user_uploads/${userId}/${uniqueId}_${newFile.name}`,
                downloadURL: downloadURL,
                updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
              } : f);
              localStorage.setItem(mainFilesKey, JSON.stringify(next));
              window.dispatchEvent(new Event('vaultflow:update'));
            } catch {}
          }

          setIsUploading(false);
          setSuccessMsg("New version uploaded successfully.");
          setTimeout(() => setSuccessMsg(null), 3000);
          
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }, 150);

    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
      setIsUploading(false);
    }
  };

  const handleRestore = async (version: FileVersion) => {
    if (!file) return;
    if (!window.confirm(`Are you sure you want to restore the version from ${formatDate(version.archivedAt)}? The current file will be archived.`)) return;

    setIsUploading(true); // Reuse loading state
    
    try {
        // 1. Archive current
        await archiveCurrentFile();

        // 2. Update main doc with version data in localStorage
        const mainFilesKey = `vaultflow_files_${userId}`;
        const currentFilesRaw = localStorage.getItem(mainFilesKey);
        if (currentFilesRaw) {
          try {
            const parsed = JSON.parse(currentFilesRaw);
            const next = parsed.map((f: any) => f.id === file.id ? {
              ...f,
              name: version.name,
              size: version.size,
              storagePath: version.storagePath,
              downloadURL: version.downloadURL,
              updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
            } : f);
            localStorage.setItem(mainFilesKey, JSON.stringify(next));
            window.dispatchEvent(new Event('vaultflow:update'));
          } catch {}
        }

        setSuccessMsg("Version restored successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);

    } catch (err) {
        console.error("Restore error:", err);
        setError("Failed to restore version.");
    } finally {
        setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <div>
             <h3 className="font-bold text-slate-900 flex items-center gap-2">
               <Clock size={18} className="text-emerald-600" />
               Version History
             </h3>
             <p className="text-xs text-slate-500 mt-1 max-w-[250px] truncate">{file.name}</p>
           </div>
           <button 
             onClick={onClose}
             className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
           >
             <X size={18} />
           </button>
        </div>

        {/* Actions Area */}
        <div className="p-6 border-b border-slate-100 bg-white">
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {error}
                </div>
            )}
            
            {successMsg && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    {successMsg}
                </div>
            )}

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isUploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload size={16} />}
                    Upload New Version
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleUploadNewVersion}
                />
            </div>
            {isUploading && uploadProgress > 0 && (
                 <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                 </div>
            )}
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </div>
            ) : versions.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                        <Clock size={20} />
                    </div>
                    <p className="text-sm text-slate-500">No previous versions found.</p>
                </div>
            ) : (
                versions.map((version) => (
                    <div key={version.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{version.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>{formatDate(version.archivedAt)}</span>
                                    <span>•</span>
                                    <span>{formatFileSize(version.size)}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleRestore(version)}
                            disabled={isUploading}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex flex-col items-center gap-1 disabled:opacity-30"
                            title="Restore this version"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default FileVersionModal;
