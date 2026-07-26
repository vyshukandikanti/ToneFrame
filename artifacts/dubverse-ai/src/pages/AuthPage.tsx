import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegister, setAuthTokenGetter } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Chrome, Github, Lock, Mail, User } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await loginMutation.mutateAsync({
        data: { email, password }
      });
      localStorage.setItem("token", res.accessToken);
      localStorage.setItem("user", JSON.stringify(res.user));
      
      // Hook up token getter dynamically
      setAuthTokenGetter(() => localStorage.getItem("token"));
      
      toast.success(`Welcome back, ${res.user.fullName}!`);
      setLocation("/dashboard");
    } catch (err: any) {
      toast.error(err.data?.error || err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await registerMutation.mutateAsync({
        data: { email, password, fullName }
      });
      localStorage.setItem("token", res.accessToken);
      localStorage.setItem("user", JSON.stringify(res.user));
      
      setAuthTokenGetter(() => localStorage.getItem("token"));
      
      toast.success("Account created successfully!");
      setLocation("/dashboard");
    } catch (err: any) {
      toast.error(err.data?.error || err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090f] text-foreground flex items-center justify-center p-6 mesh-bg">
      <Card className="w-full max-w-md bg-white/03 backdrop-blur-xl border-white/08 shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center pt-8 pb-4">
          <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
            DubVerse<span className="gradient-text-gold">AI</span>
          </CardTitle>
          <CardDescription className="text-white/40 mt-1">
            Studio-quality AI dubbing and translation
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 bg-white/05 rounded-lg p-1 border border-white/05 mb-6">
              <TabsTrigger
                value="login"
                className="rounded-md text-[13px] font-medium text-white/50 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="rounded-md text-[13px] font-medium text-white/50 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-white/60">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 bg-white/05 border-white/08 focus:border-violet-500/50 rounded-xl text-white text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-white/60">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 bg-white/05 border-white/08 focus:border-violet-500/50 rounded-xl text-white text-[14px]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl py-6 font-medium text-[14px] mt-4"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-white/60">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-11 bg-white/05 border-white/08 focus:border-violet-500/50 rounded-xl text-white text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-white/60">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 bg-white/05 border-white/08 focus:border-violet-500/50 rounded-xl text-white text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-white/60">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 bg-white/05 border-white/08 focus:border-violet-500/50 rounded-xl text-white text-[14px]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl py-6 font-medium text-[14px] mt-4"
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pb-8 pt-4">
          <div className="relative w-full flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-white/08" />
            <span className="relative bg-[#0b0b12] px-3 text-[11px] uppercase tracking-wider text-white/30">
              Or continue with
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => toast.info("Google Authentication is placeholder in dev environment")}
              className="bg-white/02 border-white/08 hover:bg-white/05 text-white rounded-xl py-5"
            >
              <Chrome className="w-4 h-4 mr-2" /> Google
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => toast.info("Github Authentication is placeholder in dev environment")}
              className="bg-white/02 border-white/08 hover:bg-white/05 text-white rounded-xl py-5"
            >
              <Github className="w-4 h-4 mr-2" /> Github
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
