/* Test-only inclusion gives access to the two-limb witness arithmetic. */
#include <stdio.h>
#include <inttypes.h>
#include "../src/kernel.c"
int main(void){int64_t a,b,c,d;while(scanf("%" SCNd64 " %" SCNd64 " %" SCNd64 " %" SCNd64,&a,&b,&c,&d)==4){LB128 x=lb_product(a,b),y=lb_product(c,d),z=x;int ok=lb_add(&z,y);printf("%016" PRIx64 "%016" PRIx64 " %d %016" PRIx64 "%016" PRIx64 "\n",x.hi,x.lo,ok,z.hi,z.lo);}return 0;}
