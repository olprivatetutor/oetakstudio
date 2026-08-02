"use client";

import { FormEvent, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

type SetupResult = { totpURI: string; backupCodes: string[] };

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [setup, setSetup] = useState<SetupResult>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.enable({ password });
    if (result.error) setError(result.error.message ?? "Two-factor setup failed");
    else if (result.data) setSetup(result.data);
    setIsLoading(false);
  }

  async function verify() {
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) setError(result.error.message ?? "Code verification failed");
    else {
      setIsEnabled(true);
      setSetup(undefined);
      setCode("");
    }
    setIsLoading(false);
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.disable({ password });
    if (result.error) setError(result.error.message ?? "Two-factor disable failed");
    else setIsEnabled(false);
    setIsLoading(false);
  }

  if (isEnabled) {
    return <form onSubmit={disable} className="space-y-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-emerald-600" />Authenticator protection is enabled</div><div className="space-y-2"><Label htmlFor="disable-password">Current password</Label><Input id="disable-password" name="password" type="password" required /></div><Button type="submit" variant="outline" disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}Disable two-factor</Button>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</form>;
  }

  if (setup) {
    return <div className="space-y-5"><div className="space-y-2"><Label>Authenticator URI</Label><Input value={setup.totpURI} readOnly /></div><div className="space-y-2"><Label>Verification code</Label><InputOTP value={code} onChange={setCode} maxLength={6}><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup></InputOTP></div><Button type="button" onClick={verify} disabled={isLoading || code.length !== 6}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Confirm authenticator</Button><div className="grid grid-cols-2 gap-2 font-mono text-xs">{setup.backupCodes.map((backupCode) => <div key={backupCode} className="rounded border p-2">{backupCode}</div>)}</div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</div>;
  }

  return <form onSubmit={enable} className="space-y-4"><div className="space-y-2"><Label htmlFor="enable-password">Current password</Label><Input id="enable-password" name="password" type="password" required /></div><Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Set up authenticator</Button>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</form>;
}
