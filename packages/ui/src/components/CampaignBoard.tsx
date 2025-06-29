import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Calendar,
  Pen,
  CheckCircle,
  Coins,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  type DerivedCampaign,
  type DerivedCrowdFundingContractState,
} from "@crowd-funding/crowd-funding-api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import { DialogHeader } from "./ui/dialog";
import { Label } from "@radix-ui/react-label";
import { Input } from "./ui/input";
import useDeployment from "@/hookes/useDeployment";
import React, { useEffect, useState } from "react";
import { calculateExpiryDate } from "@/lib/actions";
import { Textarea } from "./ui/textarea";
import { CampaignStatus } from "@crowd-funding/crowd-funding-contract";
import { Progress } from "@radix-ui/react-progress";
import { toast } from "react-hot-toast";
import { uint8arraytostring } from "../../../api/dist/utils";

const CampaignBoard = React.memo(() => {
  const deploymentContext = useDeployment();
  const [campaigns, setCampaigns] = useState<DerivedCampaign[] | []>([]);
  const [isDonatingId, setIsDonatingId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isWithdrawingId, setIsWithdrawingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEnding, setIsEnding] = useState<string | null>(null);
  const [isRefunding, setIsRefunding] = useState<string | null>(null);
  const [isCanceliing, setIsCanceliing] = useState<string | null>(null);

  const deploymentProvider = deploymentContext?.crowdFundingApi;

  useEffect(() => {
    if (!deploymentProvider) return;

    setIsLoading(true);
    const stateSubscription = deploymentProvider.state.subscribe(
      (state: DerivedCrowdFundingContractState) => {
        setCampaigns(state.campaigns ?? []);
        setIsLoading(false);
      }
    );

    return () => {
      stateSubscription.unsubscribe();
    };
  }, [deploymentProvider]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-zinc-400">
        <svg
          className="w-16 h-16 mb-4 text-zinc-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-lg font-semibold">No campaigns found</p>
        <p className="text-sm mt-2">Start a new campaign to see it here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <Card
          key={campaign.id}
          className="hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm hover:bg-zinc-900/70 hover:border-zinc-700/50 group"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2 items-center">
                <Button
                  onClick={async () => {
                    setIsWithdrawingId(campaign.id);
                    try {
                      const txData =
                        await deploymentContext?.crowdFundingApi?.withdrawCampaignFunds(
                          campaign.id
                        );
                      setIsWithdrawingId(null);
                      if (txData?.public.status == "SucceedEntirely") {
                        toast.success("Transaction successful");
                      } else {
                        toast.error("Transaction Failed");
                      }
                    } catch (error) {
                      const errMsg =
                        error instanceof Error
                          ? error.message
                          : "Failed to withdraw";
                      toast.error(errMsg);
                      setIsWithdrawingId(null);
                    }
                  }}
                  variant="outline"
                  className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                  disabled={
                    isWithdrawingId === campaign.id ||
                    campaign.campaign.status == CampaignStatus.closed ||
                    campaign.campaign.status == CampaignStatus.withdrawn
                  }
                >
                  <Coins className="w-4 h-4" />
                  {isWithdrawingId === campaign.id ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Withdrawing...
                    </>
                  ) : (
                    "Withdraw"
                  )}
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                      disabled={
                        isRefunding === campaign.id ||
                        campaign.campaign.status == CampaignStatus.closed ||
                        campaign.campaign.status == CampaignStatus.withdrawn
                      }
                    >
                      <Coins className="w-4 h-4" />
                      {isRefunding === campaign.id ? (
                        <>
                          <Loader2 className="animate-spin w-4 h-4" />
                          Refunding...
                        </>
                      ) : (
                        "Requet refund"
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl z-[9999] fixed inset-0 flex items-center justify-center"
                    style={{ padding: 0 }}
                  >
                    <div className="w-full max-w-md mx-auto p-6 bg-zinc-900/95 border-zinc-700/50 rounded-lg shadow-lg">
                      <DialogHeader>
                        <DialogTitle className="text-zinc-100">
                          Request refund from campaign
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                          Sends back part or all of your asset deposited into
                          the campaign (ONLY ACTIVE CAMPAIGNS).
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setIsRefunding(campaign.id);
                          const formData = new FormData(e.currentTarget);
                          try {
                            const txData =
                              await deploymentContext?.crowdFundingApi?.requestRefund(
                                campaign.id,
                                Number(formData.get("refund_amount")),
                                Number(formData.get("deposit"))
                              );
                            setIsRefunding(null);
                            if (txData?.public.status == "SucceedEntirely") {
                              toast.success("Transaction successful");
                            } else {
                              toast.error("Transaction Failed");
                            }
                          } catch (error) {
                            const errMsg =
                              error instanceof Error
                                ? error.message
                                : "Failed to Refund";
                            toast.error(errMsg);
                            setIsRefunding(null);
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-zinc-200">
                              Amount to refund
                            </Label>
                            <Input
                              id="refund_amount"
                              name="refund_amount"
                              placeholder="0 tDUST"
                              type="number"
                              required
                              className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="description"
                              className="text-zinc-200"
                            >
                              How much did you deposit
                            </Label>
                            <Input
                              id="deposit"
                              name="deposit"
                              placeholder="0 tDUST"
                              type="number"
                              required
                              className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                            />
                          </div>
                        </div>
                        <Button
                          disabled={isRefunding === campaign.id}
                          type="submit"
                          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg"
                        >
                          {isRefunding === campaign.id ? (
                            <>
                              <Loader2 className="animate-spin w-4 h-4 mr-2" />
                              Requesting...
                            </>
                          ) : (
                            "Request"
                          )}
                        </Button>
                      </form>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {campaign.campaign.status == CampaignStatus.closed ||
              campaign.campaign.status == CampaignStatus.withdrawn ? (
                <span className="p-1 bg-red-500 rounded-full"></span>
              ) : (
                <span className="p-1 bg-green-500 rounded-full"></span>
              )}
            </div>
            <span className="p-2 rounded-3xl text-zinc-100 w-max border border-zinc-100 mb-4">{`0x${uint8arraytostring(campaign.campaign.owner).slice(0, 8)}...`}</span>
            <CardTitle className="line-clamp-2 text-zinc-100 text-xl">
              {campaign.campaign.title}
            </CardTitle>
            <CardDescription className="line-clamp-3 text-zinc-400 leading-relaxed">
              {campaign.campaign.desc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-zinc-200">
                  {campaign.campaign.raised} tDUST raised
                </span>
                <span className="text-zinc-500">
                  {campaign.campaign.fundGoal} tDUST goal
                </span>
              </div>
              <Progress
                value={
                  Number(campaign.campaign.fundGoal) === 0
                    ? 0
                    : Math.floor(
                        (Number(campaign.campaign.raised) * 100) /
                          Number(campaign.campaign.fundGoal)
                      )
                }
                className="h-2 bg-zinc-800 relative overflow-hidden rounded"
              >
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{
                    width: `${
                      Number(campaign.campaign.fundGoal) === 0
                        ? 0
                        : Math.floor(
                            (Number(campaign.campaign.raised) * 100) /
                              Number(campaign.campaign.fundGoal)
                          )
                    }%`,
                  }}
                />
              </Progress>
            </div>

            <div className="flex flex-col text-sm text-zinc-400">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{campaign.campaign.contributors} contributors</span>
                </div>
                <div className=" flex items-center gap-2">
                  <Button
                    onClick={async () => {
                      setIsEnding(campaign.id + "-end");
                      try {
                        const txData =
                          await deploymentContext?.crowdFundingApi?.endCampaign(
                            campaign.id
                          );
                        setIsEnding(null);
                        if (txData?.public.status == "SucceedEntirely") {
                          toast.success("Transaction successful");
                        } else {
                          toast.error("Transaction Failed");
                        }
                      } catch (error) {
                        const errMsg =
                          error instanceof Error
                            ? error.message
                            : "Failed to end campaign";
                        toast.error(errMsg);
                        setIsEnding(null);
                      }
                    }}
                    variant="outline"
                    className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                    disabled={
                      isEnding === campaign.id + "-end" ||
                      campaign.campaign.status == CampaignStatus.closed ||
                      campaign.campaign.status == CampaignStatus.withdrawn
                    }
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isEnding === campaign.id + "-end" ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Ending...
                      </>
                    ) : (
                      "End"
                    )}
                  </Button>

                  <Button
                    onClick={async () => {
                      setIsCanceliing(campaign.id + "-end");
                      try {
                        const txData =
                          await deploymentContext?.crowdFundingApi?.cancelCampaign(
                            campaign.id
                          );
                        setIsCanceliing(null);
                        if (txData?.public.status == "SucceedEntirely") {
                          toast.success("Transaction successful");
                        } else {
                          toast.error("Transaction Failed");
                        }
                      } catch (error) {
                        const errMsg =
                          error instanceof Error
                            ? error.message
                            : "Failed to end campaign";
                        toast.error(errMsg);
                        setIsCanceliing(null);
                      }
                    }}
                    variant="outline"
                    className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                    disabled={
                      isCanceliing === campaign.id + "-end" ||
                      campaign.campaign.status == CampaignStatus.closed ||
                      campaign.campaign.status == CampaignStatus.withdrawn
                    }
                  >
                    {isCanceliing === campaign.id + "-end" ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                      </>
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {calculateExpiryDate(
                      Number(campaign.campaign.duration),
                      Number(campaign.campaign.creationDate)
                    )}
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    {deploymentContext?.hasJoined && (
                      <Button
                        disabled={
                          campaign.campaign.status == CampaignStatus.closed ||
                          campaign.campaign.status == CampaignStatus.withdrawn
                        }
                        variant="outline"
                        className="gap-2 bg-zinc-900/50 border-zinc-700/50 text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm"
                      >
                        <Pen className="w-4 h-4" />
                        Edit Pool
                      </Button>
                    )}
                  </DialogTrigger>
                  <DialogContent
                    className="bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl z-[9999] fixed inset-0 flex items-center justify-center"
                    style={{ padding: 0 }}
                  >
                    <div className="w-full max-w-md mx-auto p-6 bg-zinc-900/95 border-zinc-700/50 rounded-lg shadow-lg">
                      <DialogHeader>
                        <DialogTitle className="text-zinc-100">
                          Edit Funding Pool
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                          Update crowdfunding campaign fund goal and duration
                          for your project.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setIsEditingId(campaign.id);
                          const formData = new FormData(e.currentTarget);
                          try {
                            const txData =
                              await deploymentContext?.crowdFundingApi?.updateCampaign(
                                campaign.id,
                                formData.get("title") as string,
                                formData.get("description") as string,
                                Number(formData.get("target")),
                                Number(formData.get("duration"))
                              );
                            if (txData?.public.status == "SucceedEntirely") {
                              toast.success("Transaction successful");
                            } else {
                              toast.error("Transaction Failed");
                            }
                            setIsEditingId(null);
                          } catch (error) {
                            const errMsg =
                              error instanceof Error
                                ? error.message
                                : "Failed to Edit Campaign";
                            toast.error(errMsg);
                            setIsEditingId(null);
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="title" className="text-zinc-200">
                            Project Title
                          </Label>
                          <Input
                            id="title"
                            name="title"
                            placeholder={campaign.campaign.title}
                            required
                            className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="description"
                            className="text-zinc-200"
                          >
                            Description
                          </Label>
                          <Textarea
                            id="description"
                            name="description"
                            placeholder={campaign.campaign.desc}
                            required
                            className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
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
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="deadline" className="text-zinc-200">
                              Duration (No. of days)
                            </Label>
                            <Input
                              id="duration"
                              name="duration"
                              type="number"
                              required
                              className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100"
                            />
                          </div>
                        </div>
                        <Button
                          disabled={isEditingId === campaign.id}
                          type="submit"
                          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg"
                        >
                          {isEditingId === campaign.id ? (
                            <>
                              <Loader2 className="animate-spin w-4 h-4 mr-2" />
                              Editing...
                            </>
                          ) : (
                            "Edit Pool"
                          )}
                        </Button>
                      </form>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    disabled={
                      isDonatingId === campaign.id ||
                      campaign.campaign.status == CampaignStatus.closed ||
                      campaign.campaign.status == CampaignStatus.withdrawn
                    }
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg"
                  >
                    {isDonatingId === campaign.id ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Funding...
                      </>
                    ) : (
                      "Fund Campaign"
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="text-zinc-100">
                      Donate to {campaign.campaign.title}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Enter the amount you'd like to contribute to this project.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsDonatingId(campaign.id);
                      const formData = new FormData(e.currentTarget);
                      const amount = Number.parseFloat(
                        formData.get("amount") as string
                      );
                      try {
                        const txData =
                          await deploymentContext?.crowdFundingApi?.fundCampaign(
                            campaign.id,
                            amount
                          );
                        if (txData?.public.status == "SucceedEntirely") {
                          toast.success("Transaction successful");
                        } else {
                          toast.error("Transaction Failed");
                        }
                        setIsDonatingId(null);
                      } catch (error) {
                        const errMsg =
                          error instanceof Error
                            ? error.message
                            : "Failed to Fund Campaign";
                        toast.error(errMsg);
                        setIsDonatingId(null);
                      }
                      console.log(amount);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-zinc-200">
                        Amount (tDUST)
                      </Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="5"
                        placeholder="5"
                        required
                        className="bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <Button
                      disabled={isDonatingId === campaign.id}
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg"
                    >
                      {isDonatingId === campaign.id ? (
                        <>
                          <Loader2 className="animate-spin w-4 h-4 mr-2" />
                          Sending funds...
                        </>
                      ) : (
                        "Donate Now"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

export default CampaignBoard;
