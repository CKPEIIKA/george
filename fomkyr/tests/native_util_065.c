#include "../native/support.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(int argc,char**argv){char*s=read_file(argc>1?argv[1]:"-",64000000,NULL);if(!s)return 2;char h[65];sha256_hex(s,strlen(s),h);puts(h);Json j;int rc=json_parse(&j,s);printf("json=%d\n",rc);json_free(&j);free(s);return 0;}
