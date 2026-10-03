/* SPDX-License-Identifier: MIT */
#ifndef FK_SUPPORT_H
#define FK_SUPPORT_H
#include <stdint.h>
#include <stddef.h>
typedef struct {char *s;size_t n,cap;} Buffer;
void buf_add(Buffer*,const char*);void buf_n(Buffer*,const char*,size_t);void buf_printf(Buffer*,const char*,...);
void buf_string(Buffer*,const char*);void buf_free(Buffer*);
void sha256_hex(const void*,size_t,char[65]);
typedef struct {int start,end,next,count;char type;} Token;
typedef struct {char *text;Token *t;int n,cap,pos;size_t len;} Json;
int json_parse(Json*,char*);void json_free(Json*);int json_key(Json*,int,const char*);
char *json_string(Json*,int);uint64_t json_u64(Json*,int,int*);char *json_compact(const char*,size_t);
char *read_file(const char*,size_t,size_t*);int write_atomic(const char*,const char*,const void*,size_t);
int mkdir_tree(const char*);char *path_join(const char*,const char*);
#endif
