import { Button } from "@/components/ui/button";
import * as uuid from "uuid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Plus, Target, Link, Loader2 } from "lucide-react";
import useMidnightWallet from "@/hookes/useMidnightWallet";
import useDeployment from "@/hookes/useDeployment";
import CampaignBoard from "./CampaignBoard";
import { useState, type FormEvent } from "react";
import { nativeToken } from "@midnight-ntwrk/ledger";
import toast from "react-hot-toast";

export default function Component() {
  const walletContext = useMidnightWallet();
  const deploymentContext = useDeployment();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const createCampaign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const formData = new FormData(e.currentTarget);
      const txData = await deploymentContext?.crowdFundingApi?.createCampaign(
        uuid.v4(),
        formData.get("title") as string,
        formData.get("description") as string,
        nativeToken(),
        Number(formData.get("duration")),
        Number(formData.get("target"))
      );

      if (txData?.public.status == "SucceedEntirely") {
        toast.success("Transaction successful");
        setIsOpen(false)
      } else {
        toast.error("Transaction Failed");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              FundAGoal
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {walletContext?.walletState.hasConnected && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  {deploymentContext?.hasJoined && (
                    <Button
                    onClick={() => setIsOpen(true)}
                      variant="outline"
                      className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                      disabled={isCreating}
                    >
                      <Plus className="w-4 h-4" />
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Pool"
                      )}
                    </Button>
                  )}
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="text-zinc-100">
                      Create Funding Pool
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Set up a new crowdfunding campaign for your project.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createCampaign} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-zinc-200">
                        Project Title
                      </Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="Enter project title"
                        required
                        className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-zinc-200">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Describe your project"
                        required
                        className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                        disabled={isCreating}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="target" className="text-zinc-200">
                          Fund goal (tDUST)
                        </Label>
                        <Input
                          id="target"
                          name="target"
                          type="number"
                          step="0.1"
                          placeholder="10.0"
                          required
                          className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deadline" className="text-zinc-200">
                          Duratiion
                        </Label>
                        <Input
                          id="duration"
                          name="duration"
                          type="number"
                          required
                          className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100"
                          disabled={isCreating}
                        />
                      </div>
                    </div>
                    <Button
                      disabled={isCreating}
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        "Create Pool"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {walletContext?.walletState.hasConnected ? (
              <div className="flex items-center gap-3">
                <Badge className="gap-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  {walletContext.walletState.address?.slice(0, 6)}...
                  {walletContext.walletState.address?.slice(-4)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={walletContext.disconnect}
                  className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                  disabled={walletContext.walletState.isConnecting}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={walletContext?.connectToWalletAndInitializeProviders}
                className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25"
                disabled={walletContext?.walletState.isConnecting}
              >
                <Wallet className="w-4 h-4" />
                {walletContext?.walletState.isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!walletContext?.walletState.hasConnected ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/25">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3 text-zinc-100">
              Connect Your Wallet
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
              Connect your Web3 wallet to start creating pools or donating to
              existing campaigns in the decentralized ecosystem.
            </p>
            <Button
              onClick={walletContext?.connectToWalletAndInitializeProviders}
              size="lg"
              className="gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25 px-8 py-3"
              disabled={walletContext?.walletState.isConnecting}
            >
              <Wallet className="w-5 h-5" />
              {walletContext?.walletState.isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </Button>
          </div>
        ) : (
          <div>
            {!deploymentContext?.hasJoined ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/25">
                  <Wallet className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-3 text-zinc-100">
                  Get Started with FundAGoal Today
                </h2>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
                  Discover and support innovative projects in the Web3 ecosystem
                  and contribute finacialy to their success.
                </p>
                <Button
                  onClick={deploymentContext?.onJoinContract}
                  size="lg"
                  className="gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25 px-8 py-3"
                  disabled={deploymentContext?.isJoining}
                >
                  <Link className="w-5 h-5" />
                  {deploymentContext?.isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Fetching campaigns...
                    </>
                  ) : (
                    "View campaigns"
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-10">
                  <h2 className="text-4xl font-bold mb-3 text-zinc-100">
                    Active Funding Pools
                  </h2>
                  <p className="text-zinc-400 text-lg">
                    Discover and support innovative projects in the Web3
                    ecosystem.
                  </p>
                  <CampaignBoard />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
