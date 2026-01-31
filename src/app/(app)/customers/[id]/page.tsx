import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";

// Components for the different tabs
import { OverviewTab } from "./overview";
import { ContactsTab } from "./contacts";
import { DealsTab } from "./deals";
import { InvoicesTab } from "./invoices";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const orgId = await getOrgIdOrUserId();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, orgId },
    include: {
      contacts: true,
      opportunities: true,
      activities: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      invoices: true,
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/customers"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-slate-500">
                {customer.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.phone}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {customer.address}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline">Edit Profile</Button>
            <Button variant="dark">New Deal</Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-3"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-3"
          >
            Contacts{" "}
            <Badge variant="secondary" className="ml-2 text-xs">
              {customer.contacts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="deals"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-3"
          >
            Deals{" "}
            <Badge variant="secondary" className="ml-2 text-xs">
              {customer.opportunities.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="invoices"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-3"
          >
            Invoices{" "}
            <Badge variant="secondary" className="ml-2 text-xs">
              {customer.invoices.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <OverviewTab customer={customer} />
          </TabsContent>
          <TabsContent value="contacts">
            <ContactsTab customer={customer} />
          </TabsContent>
          <TabsContent value="deals">
            <DealsTab customer={customer} />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoicesTab customer={customer} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
