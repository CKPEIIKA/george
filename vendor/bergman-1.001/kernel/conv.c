/* Creates an output file with "most" letters case transposed.

   Precise definition: The case is changed from lower to upper
   case or from upper to lower case if it is free-appearing,
   and it is not commented. A symbol is commented if it is a
   free-appearing non-slashified % (percent sign), or if is not
   signifying an end-of-line and the symbol preceeding it is
   commented. A symbol is slashified if the symbol preceeding it
   is a free-appearing non-slashified ! (exclamation mark). A
   symbol is non-free-appearing if it is (not necessarily
   immediately) preceeded by a begin-of-string symbol, such that
   there is no end-of-string symbol strictly
   between it and the begin-of-string symbol. A symbol is a
   begin-of-string symbol if it is a free-appearing non-slashified
   " (double quotation mark). A symbol is initial-ignored, if it
   is a non-free ", its precessor is not initial-ignored, and its
   successor is ". Finally, a symbol is an end-of-string symbol
   if it is a non-free-appearing ", such that neither it nor its
   precessor is initial-ignored. */

#include <stdio.h>
#include <ctype.h>

/* Macro definitions. NEXT should read the next char into s,
   and prepare for file closing and exit if that was an EOF.
   OUT(char) should output that char to the output file. */

#define NEXT if ((s=fgetc(fin))==EOF) goto end
#define OUT(Chr) fputc(Chr,fut)
#ifndef TRUE
#define TRUE 1
#endif

main(int argc,char *argv[])
{ char s;
  FILE *fin, *fut;

  /* Initiation. */
  if (argc!=3)
    {fprintf(stderr,"Usage: conv input-file output-file\n");
     exit(1);}
  if ((fin=fopen(argv[1],"r"))==NULL)
    {fprintf(stderr,"***** %s not available for input\n",argv[1]);
     exit(2);}
  if ((fut=fopen(argv[2],"w"))==NULL)
    {fprintf(stderr,"***** %s not available for output\n",argv[2]);
     exit(3);}
  NEXT;

  /* Free appearing char found. */
 freap:
  if (s=='%') goto comm;
  else if (s=='!')
    {OUT(s);
     NEXT;
     OUT(s);
     NEXT;
     goto freap;}
  else if (s=='\"')
    {OUT(s);
     NEXT;
     goto strng;}
  else if (isupper(s)) OUT(tolower(s));
  else OUT(toupper(s));
  NEXT;
  goto freap;

  /* Non-free appearing char found. */
 strng:
  while (TRUE)
    {OUT(s);
     if (s=='\"')
       {NEXT;
	if (s!='\"') goto freap;
	OUT(s);
	NEXT;}
     else NEXT;}

  /* Commented character found. */
 comm:
  while (TRUE)
    {OUT(s);
     if (s=='\n')
       {NEXT;
	goto freap;}
     NEXT;}

  /* End of file read: Close files and exit. */
 end:
  fclose(fin);
  fclose(fut);
    exit(0);
}


