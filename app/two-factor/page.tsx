"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    if (result.error) {
      setError(result.error.message ?? "Verification failed");
      setIsLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="premium-page flex min-h-screen items-center justify-center p-4"><Card className="w-full max-w-md"><CardHeader><div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div><CardTitle>Two-factor verification</CardTitle></CardHeader><CardContent><form onSubmit={verify} className="space-y-5"><div className="space-y-2"><Label htmlFor="totp-code">Authenticator code</Label><InputOTP id="totp-code" value={code} onChange={setCode} maxLength={6}><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup></InputOTP></div><Button type="submit" disabled={isLoading || code.length !== 6}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Verify</Button>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</form></CardContent></Card></main>;
}
