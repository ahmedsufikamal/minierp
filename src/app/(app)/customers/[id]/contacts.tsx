"use client";

import { Contact, Customer } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Need to check if Label exists
import { User, Mail, Phone, Briefcase, Plus, Trash2 } from "lucide-react";
import { createContactAction } from "../actions";
import { useRef, useState } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"; // Assuming Dialog might not exist, but let's try or build inline first. 
// Actually, I'll use a simple inline form for now to minimize dependencies, or a separate card.

type CustomerWithContacts = Customer & {
  contacts: Contact[];
};

export function ContactsTab({ customer }: { customer: CustomerWithContacts }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isAdding, setIsAdding] = useState(false);

  async function handleAddContact(formData: FormData) {
    formData.append("customerId", customer.id);
    await createContactAction(formData);
    formRef.current?.reset();
    setIsAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Contacts</h3>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "secondary" : "dark"} size="sm">
          {isAdding ? "Cancel" : "Add Contact"}
        </Button>
      </div>

      {isAdding && (
         <Card className="border-indigo-100 bg-indigo-50/50">
           <CardContent className="p-4">
             <form ref={formRef} action={handleAddContact} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-slate-500">First Name</label>
                  <Input name="firstName" required placeholder="Jane" className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-slate-500">Last Name</label>
                  <Input name="lastName" placeholder="Doe" className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-slate-500">Job Title</label>
                  <Input name="jobTitle" placeholder="Manager" className="bg-white" />
                </div>
                 <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-slate-500">Email</label>
                  <Input name="email" type="email" placeholder="jane@example.com" className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-slate-500">Phone</label>
                  <Input name="phone" placeholder="+1..." className="bg-white" />
                </div>
                <div className="md:col-span-2 flex justify-end pt-2">
                  <Button type="submit" variant="dark">Save Contact</Button>
                </div>
             </form>
           </CardContent>
         </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customer.contacts.map((contact) => (
          <Card key={contact.id} className="group hover:shadow-md transition">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                   <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium">
                     {contact.firstName[0]}
                   </div>
                   <div>
                     <div className="font-medium text-slate-900">{contact.firstName} {contact.lastName}</div>
                     <div className="text-xs text-slate-500 mt-0.5">{contact.jobTitle || "No Title"}</div>
                   </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 transition-colors">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {customer.contacts.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed rounded-xl">
             <User className="h-8 w-8 mx-auto text-slate-300 mb-3" />
             <p>No contacts added yet.</p>
             <Button variant="link" onClick={() => setIsAdding(true)}>Add your first contact</Button>
          </div>
        )}
      </div>
    </div>
  );
}
