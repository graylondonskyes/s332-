#include <errno.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#define DENY_ERRNO(code) (SECCOMP_RET_ERRNO | ((code) & SECCOMP_RET_DATA))
#define ALLOW SECCOMP_RET_ALLOW
#define DENY_SYSCALL(num) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, num, 0, 1), BPF_STMT(BPF_RET | BPF_K, DENY_ERRNO(EPERM))

static int install_filter(void) {
  struct sock_filter filter[] = {
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#ifdef __NR_socket
    DENY_SYSCALL(__NR_socket),
#endif
#ifdef __NR_socketpair
    DENY_SYSCALL(__NR_socketpair),
#endif
#ifdef __NR_connect
    DENY_SYSCALL(__NR_connect),
#endif
#ifdef __NR_accept
    DENY_SYSCALL(__NR_accept),
#endif
#ifdef __NR_accept4
    DENY_SYSCALL(__NR_accept4),
#endif
#ifdef __NR_bind
    DENY_SYSCALL(__NR_bind),
#endif
#ifdef __NR_listen
    DENY_SYSCALL(__NR_listen),
#endif
#ifdef __NR_mount
    DENY_SYSCALL(__NR_mount),
#endif
#ifdef __NR_umount2
    DENY_SYSCALL(__NR_umount2),
#endif
#ifdef __NR_pivot_root
    DENY_SYSCALL(__NR_pivot_root),
#endif
#ifdef __NR_ptrace
    DENY_SYSCALL(__NR_ptrace),
#endif
#ifdef __NR_setns
    DENY_SYSCALL(__NR_setns),
#endif
#ifdef __NR_unshare
    DENY_SYSCALL(__NR_unshare),
#endif
#ifdef __NR_clone3
    DENY_SYSCALL(__NR_clone3),
#endif
#ifdef __NR_process_vm_readv
    DENY_SYSCALL(__NR_process_vm_readv),
#endif
#ifdef __NR_process_vm_writev
    DENY_SYSCALL(__NR_process_vm_writev),
#endif
#ifdef __NR_bpf
    DENY_SYSCALL(__NR_bpf),
#endif
#ifdef __NR_perf_event_open
    DENY_SYSCALL(__NR_perf_event_open),
#endif
    BPF_STMT(BPF_RET | BPF_K, ALLOW)
  };
  struct sock_fprog prog = { .len = (unsigned short)(sizeof(filter) / sizeof(filter[0])), .filter = filter };
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) {
    perror("PR_SET_NO_NEW_PRIVS");
    return -1;
  }
  if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) {
    perror("PR_SET_SECCOMP");
    return -1;
  }
  return 0;
}

int main(int argc, char **argv) {
  int index = 1;
  if (argc > 1 && strcmp(argv[1], "--") == 0) index = 2;
  if (index >= argc) {
    fprintf(stderr, "usage: %s -- command [args...]\n", argv[0]);
    return 64;
  }
  if (install_filter() != 0) return 111;
  execvp(argv[index], &argv[index]);
  perror("execvp");
  return 127;
}
