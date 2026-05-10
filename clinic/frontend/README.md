# clinic Frontend

Modern Next.js frontend for the clinic healthcare management platform.

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Radix UI primitives
- TanStack Query
- Axios
- React Hook Form + Zod
- Zustand
- Framer Motion
- Recharts

## Run

```bash
npm install
npm run dev
```

## Actual Folder Structure

The structure below reflects the current files and folders in this frontend project.

```text
frontend/
	components.json
	eslint.config.mjs
	next-env.d.ts
	next.config.ts
	package-lock.json
	package.json
	postcss.config.mjs
	README.md
	tailwind.config.ts
	tsconfig.json
	public/
		clinic_logo.png
		favicon.ico
	src/
		app/
			globals.css
			layout.tsx
			page.tsx
			(auth)/
				layout.tsx
				forgot-password/
					page.tsx
				login/
					page.tsx
				register/
					page.tsx
			(protected)/
				layout.tsx
				admin/
					page.tsx
					analytics/
						page.tsx
					appointments/
						page.tsx
						new/
							page.tsx
					doctors/
						page.tsx
						new/
							page.tsx
					patients/
						page.tsx
						import/
							page.tsx
						[id]/
							page.tsx
					roles/
						page.tsx
					settings/
						page.tsx
					users/
						page.tsx
						invite/
							page.tsx
				doctor/
					page.tsx
					appointments/
						page.tsx
						new/
							page.tsx
					availability/
						page.tsx
					calendar/
						page.tsx
					patients/
						page.tsx
						[id]/
							page.tsx
					prescriptions/
						new/
							page.tsx
					records/
						new/
							page.tsx
					schedule/
						page.tsx
					settings/
						page.tsx
				patient/
					page.tsx
					appointments/
						page.tsx
					book-appointment/
						page.tsx
					notifications/
						page.tsx
					prescriptions/
						page.tsx
					profile/
						page.tsx
					records/
						page.tsx
					settings/
						page.tsx
			pharmacist/
				layout.tsx
				dashboard/
					page.tsx
				orders/
					page.tsx
				profile/
					page.tsx
		components/
			charts/
				overview-chart.tsx
			forms/
				auth-form.tsx
			layouts/
				app-shell.tsx
				page-header.tsx
				protected-gate.tsx
			shared/
				error-state.tsx
				loading-state.tsx
			ui/
				badge.tsx
				button.tsx
				card.tsx
				input.tsx
				select.tsx
				separator.tsx
				skeleton.tsx
				table.tsx
				textarea.tsx
		constants/
			index.ts
		features/
			admin/
				admin-action-pages.tsx
				admin-pages.tsx
				hooks.ts
			appointments/
				hooks.ts
			auth/
				auth-pages.tsx
				schemas.ts
			doctor/
				doctor-pages.tsx
			medical-records/
				hooks.ts
			patient/
				patient-pages.tsx
			pharmacist/
				pharmacist-layout.tsx
				pharmacist-pages.tsx
			prescriptions/
				hooks.ts
		hooks/
			use-auth.ts
			useAppointments.ts
			usePrescriptionOrders.ts
		lib/
			constants.ts
			env.ts
			token-storage.ts
			utils.ts
		middleware/
			auth.ts
		providers/
			index.tsx
		services/
			api/
				admin.ts
				appointments.ts
				auth.ts
				client.ts
				doctor.ts
				medical-records.ts
				prescription-orders.ts
				prescriptions.ts
				users.ts
		store/
			auth-store.ts
		styles/
			theme.ts
		types/
			api.ts
		utils/
			date.ts
			index.ts
```
