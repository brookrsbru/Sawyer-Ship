import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderArchive, Upload, Lock, Eye, EyeOff, Loader2, AlertCircle, FileJson } from 'lucide-react';
import { parseBackupFile } from '@/src/hooks/use-backup-archive';
import { SawyerShipment } from '@/src/hooks/use-sawyer-storage';
import { toast } from 'sonner';

interface BackupInspectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionPassword?: string | null;
  onLoaded: (shipments: SawyerShipment[], filename: string) => void;
}

export function BackupInspectorDialog({
  open,
  onOpenChange,
  sessionPassword,
  onLoaded,
}: BackupInspectorDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setFileContent(null);
    setNeedsPassword(false);
    setPassword('');
    setShowPassword(false);
    setIsLoading(false);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const content = await file.text();
      setFileContent(content);

      // Attempt 1: Try parsing without password or with current session password
      const result = await parseBackupFile(content, file.name, sessionPassword || undefined);

      if (result.success) {
        if (result.shipments.length === 0) {
          toast.warning('Backup loaded, but no shipment records were found.');
        } else {
          toast.success(`Loaded ${result.shipments.length} archived shipments from ${file.name}`);
        }
        onLoaded(result.shipments, file.name);
        handleDialogClose(false);
        return;
      }

      if (result.requiresPassword) {
        setNeedsPassword(true);
        setIsLoading(false);
        return;
      }

      setErrorMessage(result.error || 'Failed to parse backup file.');
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error reading file.');
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDecryptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent || !selectedFile || !password) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await parseBackupFile(fileContent, selectedFile.name, password);

      if (result.success) {
        if (result.shipments.length === 0) {
          toast.warning('Backup decrypted, but no shipment records were found.');
        } else {
          toast.success(`Loaded ${result.shipments.length} archived shipments from ${selectedFile.name}`);
        }
        onLoaded(result.shipments, selectedFile.name);
        handleDialogClose(false);
      } else {
        setErrorMessage(result.error || 'Failed to decrypt backup.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Decryption failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900">
            <FolderArchive className="w-5 h-5 text-amber-600" />
            Inspect Backup File (Read-Only)
          </DialogTitle>
          <DialogDescription>
            Inspect and search shipment tracking records from a historical backup in temporary memory.
            Nothing is saved to browser storage, and no retention limits are applied.
          </DialogDescription>
        </DialogHeader>

        {!needsPassword ? (
          <div className="space-y-4 py-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50 hover:bg-zinc-100/70 transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">
                  {selectedFile ? selectedFile.name : 'Choose a backup file'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Click to select <code className="text-zinc-600">sawyer-ship-backup-*.json</code>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                disabled={isLoading}
              >
                {isLoading ? 'Reading File...' : 'Select JSON File'}
              </Button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 leading-relaxed">
              <strong>Safe Inspection:</strong> This allows you to search tracking numbers, recipients, and order items from backups older than 30 days without overwriting your current data or triggering the 30-day auto-purge.
            </div>
          </div>
        ) : (
          <form onSubmit={handleDecryptSubmit} className="space-y-4 py-2">
            <div className="p-3 bg-zinc-100 rounded-lg flex items-center gap-3 text-xs text-zinc-700">
              <FileJson className="w-5 h-5 text-zinc-500 shrink-0" />
              <div className="overflow-hidden">
                <p className="font-semibold truncate">{selectedFile?.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : ''} — Encrypted Backup
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="archive-password-input" className="text-xs font-semibold text-zinc-700">
                Backup Master Password
              </Label>
              <div className="relative">
                <Input
                  id="archive-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter the password used when saved..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="pr-10 text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                This backup was encrypted with a master password. Please enter that password to decrypt and view the records in memory.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetState}
                disabled={isLoading}
              >
                Choose Different File
              </Button>
              <Button
                type="submit"
                className="bg-zinc-900 hover:bg-zinc-800 text-white gap-2"
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Decrypting...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Decrypt & View
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
