export type AuthRole = { name?: string; id?: string };

/** Auth `/auth/validate` returns `roles` as string[] (see auth-microservice roles.service). */
export type ValidatedUser = {
  id: string;
  email?: string | null;
  roles?: string[] | AuthRole[];
};
