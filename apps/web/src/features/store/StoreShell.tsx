import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PersonAvatar } from '@/components/Avatars';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { viewerQuery } from '@/lib/queries';
import { signOut } from '@/lib/session';

type Audience = 'guest' | 'customer' | 'staff';

const NAV: { to: string; label: string; audiences: Audience[] }[] = [
  { to: '/orders', label: 'Orders', audiences: ['customer'] },
  { to: '/requests', label: 'Requests', audiences: ['customer'] },
  { to: '/desk', label: 'Desk', audiences: ['staff'] },
  { to: '/policy', label: 'Refund policy', audiences: ['guest', 'customer', 'staff'] },
];

const navLink =
  'rounded-sm px-2.5 py-1.5 text-13 font-medium text-muted transition-colors hover:text-foreground data-[status=active]:bg-raised data-[status=active]:text-foreground';

/** The customer-facing chrome: "Pourhaven Support". */
export function StoreShell({ children }: { children: ReactNode }) {
  const { data: viewer } = useQuery(viewerQuery);
  const audience: Audience = !viewer ? 'guest' : viewer.staffRole ? 'staff' : 'customer';
  const links = NAV.filter((item) => item.audiences.includes(audience));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="rounded-sm" aria-label="Pourhaven Support home">
            <Logo surface="support" />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {links.map((item) => (
              <Link key={item.to} to={item.to} className={navLink}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {viewer ? (
              <AccountMenu name={viewer.user.name} email={viewer.user.email} />
            ) : (
              <Button asChild size="sm" variant="secondary">
                <Link to="/sign-in">Sign in</Link>
              </Button>
            )}
            <MobileNav links={links} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut(queryClient);
    await navigate({ to: '/sign-in' });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm py-1 pr-1.5 pl-1 text-13 font-medium text-foreground transition-colors hover:bg-raised data-[state=open]:bg-raised">
        <PersonAvatar name={name} />
        <span className="hidden sm:inline">{name}</span>
        <ChevronDown className="size-3.5 text-subtle" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-foreground">
          <span className="block text-13 font-medium">{name}</span>
          <span className="block truncate text-xs font-normal text-muted">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void onSignOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ links }: { links: { to: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-2 max-w-none translate-y-0 p-2 data-[state=open]:animate-rise">
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <div className="flex h-10 items-center px-3">
          <Logo surface="support" />
        </div>
        <nav className="mt-2 flex flex-col gap-1" aria-label="Main">
          {links.map((item) => (
            <Link key={item.to} to={item.to} className={`${navLink} px-3 py-2.5 text-sm`} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
