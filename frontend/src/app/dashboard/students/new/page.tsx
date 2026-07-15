'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const schema = z.object({
  firstName: z.string().trim().min(2, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  dateOfBirth: z.string().min(1, 'Required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  admissionDate: z.string().min(1, 'Required'),
  bloodGroup: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  medicalConditions: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  branchId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function NewStudentPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: 'MALE',
      admissionDate: new Date().toISOString().slice(0, 10),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/students',
        data: {
          ...values,
          bloodGroup: values.bloodGroup || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          addressLine1: values.addressLine1 || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          postalCode: values.postalCode || undefined,
          emergencyContactName: values.emergencyContactName || undefined,
          emergencyContactPhone: values.emergencyContactPhone || undefined,
          medicalConditions: values.medicalConditions || undefined,
          allergies: values.allergies || undefined,
          branchId: values.branchId || undefined,
        },
      }),
    onSuccess: (student) => {
      toast.success('Student enrolled');
      router.push(`/dashboard/students/${student.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not enrol student')),
  });

  const errors = form.formState.errors;

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/students">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Enrol a new student</h1>
          <p className="text-sm text-muted-foreground">Provide the student profile, contact and emergency details.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Save student
          </Button>
        </div>
      </div>

      <FormSection title="Profile" description="Personal information for the student record.">
        <FormGrid>
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...form.register('firstName')} placeholder="e.g. Aravind" />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...form.register('lastName')} placeholder="e.g. Kumar" />
          </Field>
          <Field label="Date of birth" required error={errors.dateOfBirth?.message}>
            <Input type="date" {...form.register('dateOfBirth')} />
          </Field>
          <Field label="Gender" required error={errors.gender?.message}>
            <Select
              value={form.watch('gender')}
              onValueChange={(v) => form.setValue('gender', v as FormValues['gender'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Admission date" required error={errors.admissionDate?.message}>
            <Input type="date" {...form.register('admissionDate')} />
          </Field>
          <Field label="Blood group" error={errors.bloodGroup?.message}>
            <Input {...form.register('bloodGroup')} placeholder="e.g. O+" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...form.register('email')} placeholder="student@example.com" />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...form.register('phone')} placeholder="+91 98xxxxxxxx" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input {...form.register('addressLine1')} placeholder="Street / area" />
          </Field>
          <Field label="City">
            <Input {...form.register('city')} />
          </Field>
          <Field label="State">
            <Input {...form.register('state')} />
          </Field>
          <Field label="Postal code">
            <Input {...form.register('postalCode')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Emergency & Medical">
        <FormGrid>
          <Field label="Emergency contact name">
            <Input {...form.register('emergencyContactName')} />
          </Field>
          <Field label="Emergency contact phone">
            <Input {...form.register('emergencyContactPhone')} />
          </Field>
          <Field label="Medical conditions" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('medicalConditions')} placeholder="Chronic conditions, past surgeries…" />
          </Field>
          <Field label="Allergies" className="sm:col-span-2">
            <Textarea rows={2} {...form.register('allergies')} placeholder="Food, medication, environmental…" />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}
