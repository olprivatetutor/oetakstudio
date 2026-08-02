"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { signIn } from "@/lib/auth-client";
import { ArrowLeft, Loader2, ShieldCheck, Sparkles } from "lucide-react";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                setError(result.error.message || "Sign in failed");
            } else if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
                router.push("/two-factor");
            } else {
                const appOwnerResponse = await fetch("/api/admin/me", { cache: "no-store" });
                const appOwnerResult = await appOwnerResponse.json() as { success?: boolean; data?: { canAccessOwnerConsole?: boolean; canAccessContentStudio?: boolean } };
                const nextPath = appOwnerResult.success && appOwnerResult.data?.canAccessOwnerConsole
                    ? "/admin"
                    : appOwnerResult.success && appOwnerResult.data?.canAccessContentStudio
                      ? "/content"
                      : "/dashboard";
                router.push(nextPath);
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="premium-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back home</Link>
                <Badge variant="outline"><ShieldCheck className="h-3.5 w-3.5" />Secure access</Badge>
            </div>
            <main className="mx-auto grid min-h-[calc(100svh-72px)] max-w-6xl items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr]">
                <Card className="w-full max-w-md justify-self-center p-1">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"><Sparkles className="h-5 w-5" /></div>
                        <CardTitle className="text-3xl">Welcome back</CardTitle>
                        <CardDescription>Sign in to continue your learning workspace.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="justify-center text-center">
                        <p className="text-sm text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Link href="/sign-up" className="font-semibold text-primary hover:underline">
                                Create one
                            </Link>
                        </p>
                    </CardFooter>
                </Card>

                <section className="relative hidden overflow-hidden rounded-[2rem] border bg-card/66 p-5 shadow-[var(--shadow-float)] backdrop-blur-xl lg:block">
                    <Image src="/illustrations/edtech-hero.png" alt="Modern learning workspace illustration" width={1536} height={1024} className="aspect-[4/3] rounded-[1.5rem] object-cover" />
                    <div className="absolute bottom-8 left-8 right-8 rounded-[1.5rem] border bg-card/82 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl">
                        <div className="mb-3 flex items-center justify-between"><span className="font-semibold">Today&apos;s learning pulse</span><Badge variant="secondary">84%</Badge></div>
                        <Progress value={84} />
                    </div>
                </section>
            </main>
        </div>
    );
}
