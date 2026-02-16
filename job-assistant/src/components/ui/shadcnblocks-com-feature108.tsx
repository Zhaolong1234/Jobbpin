"use client";

import type { ReactNode } from "react";
import { Layout, Pointer, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabContent {
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  imageSrc: string;
  imageAlt: string;
}

interface Tab {
  value: string;
  icon: ReactNode;
  label: string;
  content: TabContent;
}

interface Feature108Props {
  badge?: string;
  heading?: string;
  description?: string;
  tabs?: Tab[];
}

const Feature108 = ({
  badge = "shadcnblocks.com",
  heading = "A Collection of Components Built With Shadcn & Tailwind",
  description = "Join us to build flawless web solutions.",
  tabs = [
    {
      value: "tab-1",
      icon: <Zap className="h-auto w-4 shrink-0" />,
      label: "Boost Revenue",
      content: {
        badge: "Modern Tactics",
        title: "Make your site a true standout.",
        description:
          "Discover new web trends that help you craft sleek, highly functional sites that drive traffic and convert leads into customers.",
        buttonText: "See Plans",
        imageSrc:
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
        imageAlt: "Analytics dashboard",
      },
    },
    {
      value: "tab-2",
      icon: <Pointer className="h-auto w-4 shrink-0" />,
      label: "Higher Engagement",
      content: {
        badge: "Expert Features",
        title: "Boost your site with top-tier design.",
        description:
          "Use stellar design to easily engage users and strengthen their loyalty. Create a seamless experience that keeps them coming back for more.",
        buttonText: "See Tools",
        imageSrc:
          "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1400&q=80",
        imageAlt: "Team collaboration",
      },
    },
    {
      value: "tab-3",
      icon: <Layout className="h-auto w-4 shrink-0" />,
      label: "Stunning Layouts",
      content: {
        badge: "Elite Solutions",
        title: "Build an advanced web experience.",
        description:
          "Lift your brand with modern tech that grabs attention and drives action. Create a digital experience that stands out from the crowd.",
        buttonText: "See Options",
        imageSrc:
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80",
        imageAlt: "Product strategy session",
      },
    },
  ],
}: Feature108Props) => {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1360px] px-5 md:px-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="bg-white/80 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-700">
            {badge}
          </Badge>
          <h2 className="max-w-3xl text-balance text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">
            {heading}
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">{description}</p>
        </div>

        <Tabs defaultValue={tabs[0].value} className="mt-10">
          <TabsList className="mx-auto grid h-auto max-w-3xl grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 sm:grid-cols-3">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex h-12 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_14px_32px_rgba(15,23,42,0.08)] lg:p-12">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]"
              >
                <div className="flex flex-col gap-5">
                  <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
                    {tab.content.badge}
                  </Badge>
                  <h3 className="text-3xl font-semibold leading-tight text-slate-900 lg:text-4xl">{tab.content.title}</h3>
                  <p className="text-base leading-relaxed text-slate-600 lg:text-lg">{tab.content.description}</p>
                  <Button className="mt-2.5 w-fit rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700" size="lg">
                    {tab.content.buttonText}
                  </Button>
                </div>
                <img
                  src={tab.content.imageSrc}
                  alt={tab.content.imageAlt}
                  className="h-[280px] w-full rounded-2xl object-cover shadow-[0_14px_34px_rgba(15,23,42,0.18)] md:h-[360px]"
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
};

export { Feature108 };
