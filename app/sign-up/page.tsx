"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { signUp } from "@/lib/auth-client";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from "lucide-react";

const signUpSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, "Password must contain uppercase, lowercase, number, and special characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const router = useRouter();

    const form = useForm<SignUpForm>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (data: SignUpForm) => {
        setIsLoading(true);
        setError("");

        try {
            const result = await signUp.email({
                email: data.email,
                password: data.password,
                name: data.name,
            });

            if (result.error) {
                setError(result.error.message || "Sign up failed");
            } else {
                router.push("/dashboard");
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
                <Badge variant="outline"><ShieldCheck className="h-3.5 w-3.5" />Private by design</Badge>
            </div>
            <main className="mx-auto grid min-h-[calc(100svh-72px)] max-w-6xl items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="relative hidden overflow-hidden rounded-[2rem] border bg-card/66 p-5 shadow-[var(--shadow-float)] backdrop-blur-xl lg:block">
                    <Image src="/illustrations/edtech-hero.png" alt="Modern learning platform illustration" width={1536} height={1024} className="aspect-[4/3] rounded-[1.5rem] object-cover" />
                    <div className="absolute bottom-8 left-8 right-8 rounded-[1.5rem] border bg-card/82 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl">
                        <div className="mb-3 flex items-center justify-between"><span className="font-semibold">Onboarding readiness</span><Badge variant="secondary">3 steps</Badge></div>
                        <Progress value={33} />
                    </div>
                </section>

                <Card className="w-full max-w-lg justify-self-center p-1">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"><Sparkles className="h-5 w-5" /></div>
                        <CardTitle className="text-3xl">Create your workspace</CardTitle>
                        <CardDescription>Start a personal learning path or build an organization catalog.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter your full name" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="you@example.com" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input type={showPassword ? "text" : "password"} placeholder="Create a strong password" {...field} disabled={isLoading} className="pr-12" />
                                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-9 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" {...field} disabled={isLoading} className="pr-12" />
                                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-9 -translate-y-1/2" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading}>
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account...</> : "Create account"}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                    <CardFooter className="justify-center text-center">
                        <p className="text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/sign-in" className="font-semibold text-primary hover:underline">Sign in</Link>
                        </p>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
